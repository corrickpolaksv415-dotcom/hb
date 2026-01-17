import { Injectable, signal, computed, effect } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- Interfaces ---
export interface Board {
  id: string;
  title: string;
  creator: string;
  isPrivate: boolean; // Mapped to is_private in DB
  backgroundColor?: string; // Mapped to background_color
  createdAt: number; // created_at
  activeVersionId?: string; // active_version_id
  isPinned?: boolean; // is_pinned
}

export interface BoardItem {
  id: string;
  boardId: string; // board_id
  author: string;
  imageData: string; // image_data
  timestamp: number;
}

export interface CanvasElement {
  id: string;
  boardId: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  author: string;
  // Optional / Specific
  width?: number;
  height?: number;
  content?: string;
  font?: string;
  color?: string;
  fontSize?: number; // font_size
  fontStyleKey?: string; // font_style_key
  strokeColor?: string; // stroke_color
  strokeWidth?: number; // stroke_width
  imageSrc?: string; // image_src in DB
  // Runtime only
  image?: HTMLImageElement;
}

export interface UserProfile {
  uid: string;
  avatar?: string;
  isAdmin?: boolean; // is_admin
  adminTag?: string; // admin_tag
  lastActive?: number; // last_active
  chatBackground?: string; // chat_background
}

export interface ChatMessage {
  id: string;
  sender: string;
  receiver?: string;
  groupId?: string; // group_id
  content: string;
  timestamp: number;
  type?: 'text' | 'image'; 
  readBy?: string[]; // read_by (jsonb)
  isRecalled?: boolean; // is_recalled
}

export interface ChatGroup {
  id: string;
  name: string;
  creator: string;
  members: string[]; // jsonb
}

export interface ForumPost {
  id: string;
  author: string;
  title: string;
  content: string;
  isPinned?: boolean; // is_pinned
  timestamp: number;
  comments: ForumComment[]; // Joined at runtime
}

export interface ForumComment {
  id: string;
  postId: string; // post_id
  author: string;
  content: string;
  timestamp: number;
}

export interface LikeRecord {
  id: string;
  targetId: string; // target_id
  targetType: 'board' | 'post' | 'user'; // target_type
  userId: string; // user_id
  timestamp: number;
}

export interface FollowRecord {
  id: string;
  followerId: string; // follower_id
  followingId: string; // following_id
  timestamp: number;
}

export interface Notification {
  id: string;
  recipientId: string; // recipient_id
  type: 'system' | 'like' | 'follow' | 'comment' | 'board_update' | 'pin';
  title: string;
  content: string;
  linkTo?: string; // link_to
  isRead: boolean; // is_read
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private supabase: SupabaseClient;
  
  // State
  currentUser = signal<string | null>(null);
  currentBoardId = signal<string | null>(null);
  showUserCenter = signal<boolean>(false);
  showChat = signal<boolean>(false);
  announcement = signal<string>('');
  
  // Sorting Preferences
  boardSortMethod = signal<'new' | 'hot'>('hot');
  postSortMethod = signal<'new' | 'hot'>('hot');

  // Data Signals (Synced from DB)
  private allBlessings = signal<BoardItem[]>([]);
  private allBoards = signal<Board[]>([]);
  private allProfiles = signal<UserProfile[]>([]);
  private allMessages = signal<ChatMessage[]>([]);
  private allGroups = signal<ChatGroup[]>([]);
  private allPosts = signal<ForumPost[]>([]);
  private allComments = signal<ForumComment[]>([]);
  private allUserIds = signal<string[]>([]);
  
  private allLikes = signal<LikeRecord[]>([]);
  private allFollows = signal<FollowRecord[]>([]);
  private allNotifications = signal<Notification[]>([]);
  
  // Board Specific: Active Canvas Elements
  currentBoardElements = signal<CanvasElement[]>([]);

  // --- Computed ---

  activeBoard = computed(() => 
    this.allBoards().find(b => b.id === this.currentBoardId())
  );

  currentBoardBlessings = computed(() => 
    this.allBlessings()
      .filter(b => b.boardId === this.currentBoardId())
      .sort((a, b) => b.timestamp - a.timestamp)
  );

  publicBoards = computed(() => {
    const method = this.boardSortMethod();
    const boards = this.allBoards().filter(b => !b.isPrivate);
    
    return boards.sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
      
      if (method === 'new') {
        return b.createdAt - a.createdAt;
      } else {
        const scoreA = (this.getLikeCount(a.id) * 2) + this.getBoardItemCount(a.id);
        const scoreB = (this.getLikeCount(b.id) * 2) + this.getBoardItemCount(b.id);
        return scoreB - scoreA;
      }
    });
  });

  myBoards = computed(() => 
    this.allBoards()
      .filter(b => b.creator === this.currentUser())
      .sort((a, b) => b.createdAt - a.createdAt)
  );

  currentUserProfile = computed(() => 
    this.allProfiles().find(p => p.uid === this.currentUser())
  );

  isAdmin = computed(() => !!this.currentUserProfile()?.isAdmin);
  
  posts = computed(() => {
    const method = this.postSortMethod();
    // Join comments
    const posts = this.allPosts().map(p => ({
        ...p,
        comments: this.allComments().filter(c => c.postId === p.id).sort((x, y) => x.timestamp - y.timestamp)
    }));

    return posts.sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;

      if (method === 'new') {
        return b.timestamp - a.timestamp;
      } else {
        const scoreA = (this.getLikeCount(a.id) * 2) + a.comments.length;
        const scoreB = (this.getLikeCount(b.id) * 2) + b.comments.length;
        return scoreB - scoreA;
      }
    });
  });

  myNotifications = computed(() => {
      const uid = this.currentUser();
      if (!uid) return [];
      return this.allNotifications()
        .filter(n => n.recipientId === uid)
        .sort((a, b) => b.timestamp - a.timestamp);
  });
  
  unreadNotificationCount = computed(() => 
      this.myNotifications().filter(n => !n.isRead).length
  );

  userRankings = computed(() => {
      const stats = this.allUserIds().map(uid => {
          const followers = this.allFollows().filter(f => f.followingId === uid).length;
          const likesReceived = this.allLikes().filter(l => l.targetType === 'user' && l.targetId === uid).length;
          return { uid, followers, likesReceived };
      });

      return {
          byFollowers: [...stats].sort((a, b) => b.followers - a.followers).slice(0, 10),
          byLikes: [...stats].sort((a, b) => b.likesReceived - a.likesReceived).slice(0, 10)
      };
  });

  totalUnreadCount = computed(() => {
    const uid = this.currentUser();
    if (!uid) return 0;
    return this.allMessages().filter(m => {
      const isMyMsg = m.sender === uid;
      if (isMyMsg) return false;
      const isForMe = m.receiver === uid;
      const isForMyGroup = m.groupId && this.getMyGroups().some(g => g.id === m.groupId);
      if ((isForMe || isForMyGroup) && !m.readBy?.includes(uid)) {
        return true;
      }
      return false;
    }).length;
  });

  constructor() {
    // SUPABASE SETUP
    let sbUrl = '';
    let sbKey = '';

    try {
        if (typeof process !== 'undefined' && process.env) {
            sbUrl = process.env['SUPABASE_URL'] || '';
            sbKey = process.env['SUPABASE_KEY'] || '';
        }
    } catch (e) {
        console.warn('Failed to read env vars', e);
    }
    
    if (!sbUrl || !sbKey) {
        console.warn('Supabase Config Missing! Please set SUPABASE_URL and SUPABASE_KEY env variables.');
        // Fallback to prevent crash, though network requests will fail
        sbUrl = 'https://placeholder.supabase.co';
        sbKey = 'placeholder';
    }

    this.supabase = createClient(sbUrl, sbKey);

    // Initial load
    this.initRealtimeSubscriptions();
    this.fetchAllData();

    // Session restore
    const sessionUser = localStorage.getItem('supabase_session_user');
    if (sessionUser) {
        this.currentUser.set(sessionUser);
        this.updateHeartbeat();
    }
    
    const sessionBoard = localStorage.getItem('supabase_session_board');
    if (sessionBoard) {
        // Wait a bit for boards to load or just set ID
        this.currentBoardId.set(sessionBoard);
        this.subscribeToBoardElements(sessionBoard);
    }
    
    // Heartbeat
    setInterval(() => {
        if (this.currentUser()) this.updateHeartbeat();
    }, 30000);
  }

  // --- Realtime & Data Loading ---

  private async fetchAllData() {
      // Parallel fetch
      const [
          boards, items, profiles, msgs, groups, posts, comments, likes, follows, notifs, config, users
      ] = await Promise.all([
          this.supabase.from('boards').select('*'),
          this.supabase.from('board_items').select('*'),
          this.supabase.from('profiles').select('*'),
          this.supabase.from('messages').select('*'),
          this.supabase.from('chat_groups').select('*'),
          this.supabase.from('forum_posts').select('*'),
          this.supabase.from('forum_comments').select('*'),
          this.supabase.from('likes').select('*'),
          this.supabase.from('follows').select('*'),
          this.supabase.from('notifications').select('*'),
          this.supabase.from('global_config').select('*').eq('key', 'announcement').single(),
          this.supabase.from('app_users').select('uid')
      ]);

      if (boards.data) this.allBoards.set(this.mapBoards(boards.data));
      if (items.data) this.allBlessings.set(this.mapBoardItems(items.data));
      if (profiles.data) this.allProfiles.set(this.mapProfiles(profiles.data));
      if (msgs.data) this.allMessages.set(this.mapMessages(msgs.data));
      if (groups.data) this.allGroups.set(groups.data as any);
      if (posts.data) this.allPosts.set(this.mapPosts(posts.data));
      if (comments.data) this.allComments.set(this.mapComments(comments.data));
      if (likes.data) this.allLikes.set(this.mapLikes(likes.data));
      if (follows.data) this.allFollows.set(this.mapFollows(follows.data));
      if (notifs.data) this.allNotifications.set(this.mapNotifications(notifs.data));
      if (config.data) this.announcement.set(config.data.value);
      if (users.data) this.allUserIds.set(users.data.map(u => u.uid));
  }

  private initRealtimeSubscriptions() {
      // Subscribe to GLOBAL tables
      this.supabase.channel('global_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, payload => this.handleTableChange(payload, 'boards'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_items' }, payload => this.handleTableChange(payload, 'board_items'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => this.handleTableChange(payload, 'profiles'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => this.handleTableChange(payload, 'messages'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_groups' }, payload => this.handleTableChange(payload, 'chat_groups'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, payload => this.handleTableChange(payload, 'forum_posts'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_comments' }, payload => this.handleTableChange(payload, 'forum_comments'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, payload => this.handleTableChange(payload, 'likes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, payload => this.handleTableChange(payload, 'follows'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => this.handleTableChange(payload, 'notifications'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_config' }, payload => {
          if (payload.new && (payload.new as any).key === 'announcement') {
              this.announcement.set((payload.new as any).value);
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, payload => {
          if (payload.eventType === 'INSERT') this.allUserIds.update(ids => [...ids, (payload.new as any).uid]);
      })
      .subscribe();
  }

  private handleTableChange(payload: any, table: string) {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      const updateList = (signalUpdater: any, mapFn: any) => {
          if (eventType === 'INSERT') {
              signalUpdater((list: any) => [...list, mapFn ? mapFn(newRecord) : newRecord]);
          } else if (eventType === 'UPDATE') {
              signalUpdater((list: any) => list.map((item: any) => item.id === newRecord.id ? (mapFn ? mapFn(newRecord) : newRecord) : item));
          } else if (eventType === 'DELETE') {
              signalUpdater((list: any) => list.filter((item: any) => item.id !== oldRecord.id));
          }
      };

      switch(table) {
          case 'boards': updateList(this.allBoards.update, this.mapBoard); break;
          case 'board_items': updateList(this.allBlessings.update, this.mapBoardItem); break;
          case 'profiles': 
             // Special case: Profile key is UID
             if (eventType === 'INSERT') this.allProfiles.update(l => [...l, this.mapProfile(newRecord)]);
             else if (eventType === 'UPDATE') this.allProfiles.update(l => l.map(p => p.uid === newRecord.uid ? this.mapProfile(newRecord) : p));
             break;
          case 'messages': updateList(this.allMessages.update, this.mapMessage); break;
          case 'chat_groups': updateList(this.allGroups.update, null); break;
          case 'forum_posts': updateList(this.allPosts.update, this.mapPost); break;
          case 'forum_comments': updateList(this.allComments.update, this.mapComment); break;
          case 'likes': updateList(this.allLikes.update, this.mapLike); break;
          case 'follows': updateList(this.allFollows.update, this.mapFollow); break;
          case 'notifications': updateList(this.allNotifications.update, this.mapNotification); break;
      }
  }

  // --- Mappers (Snake Case DB -> Camel Case App) ---
  private mapBoards(data: any[]): Board[] { return data.map(this.mapBoard); }
  private mapBoard(d: any): Board {
      return { id: d.id, title: d.title, creator: d.creator, isPrivate: d.is_private, backgroundColor: d.background_color, createdAt: d.created_at, activeVersionId: d.active_version_id, isPinned: d.is_pinned };
  }
  private mapBoardItems(data: any[]): BoardItem[] { return data.map(this.mapBoardItem); }
  private mapBoardItem(d: any): BoardItem { return { id: d.id, boardId: d.board_id, author: d.author, imageData: d.image_data, timestamp: d.timestamp }; }
  private mapProfiles(data: any[]): UserProfile[] { return data.map(this.mapProfile); }
  private mapProfile(d: any): UserProfile { return { uid: d.uid, avatar: d.avatar, isAdmin: d.is_admin, adminTag: d.admin_tag, lastActive: d.last_active, chatBackground: d.chat_background }; }
  private mapMessages(data: any[]): ChatMessage[] { return data.map(this.mapMessage); }
  private mapMessage(d: any): ChatMessage { return { id: d.id, sender: d.sender, receiver: d.receiver, groupId: d.group_id, content: d.content, timestamp: d.timestamp, type: d.type, readBy: d.read_by, isRecalled: d.is_recalled }; }
  private mapPosts(data: any[]): ForumPost[] { return data.map(this.mapPost); }
  private mapPost(d: any): ForumPost { return { id: d.id, author: d.author, title: d.title, content: d.content, isPinned: d.is_pinned, timestamp: d.timestamp, comments: [] }; }
  private mapComments(data: any[]): ForumComment[] { return data.map(this.mapComment); }
  private mapComment(d: any): ForumComment { return { id: d.id, postId: d.post_id, author: d.author, content: d.content, timestamp: d.timestamp }; }
  private mapLikes(data: any[]): LikeRecord[] { return data.map(this.mapLike); }
  private mapLike(d: any): LikeRecord { return { id: d.id, targetId: d.target_id, targetType: d.target_type, userId: d.user_id, timestamp: d.timestamp }; }
  private mapFollows(data: any[]): FollowRecord[] { return data.map(this.mapFollow); }
  private mapFollow(d: any): FollowRecord { return { id: d.id, followerId: d.follower_id, followingId: d.following_id, timestamp: d.timestamp }; }
  private mapNotifications(data: any[]): Notification[] { return data.map(this.mapNotification); }
  private mapNotification(d: any): Notification { return { id: d.id, recipientId: d.recipient_id, type: d.type, title: d.title, content: d.content, linkTo: d.link_to, isRead: d.is_read, timestamp: d.timestamp }; }
  private mapCanvasElement(d: any): CanvasElement {
      return {
          id: d.id, boardId: d.board_id, type: d.type, x: d.x, y: d.y, author: d.author,
          width: d.width, height: d.height, content: d.content, color: d.color,
          font: d.font, fontSize: d.font_size, fontStyleKey: d.font_style_key,
          strokeColor: d.stroke_color, strokeWidth: d.stroke_width, imageSrc: d.image_src
      };
  }

  // --- Auth & User ---
  async authenticate(uid: string, password: string, registerAsAdmin: boolean = false, adminTag: string = ''): Promise<boolean> {
    const { data: user } = await this.supabase.from('app_users').select('*').eq('uid', uid).single();
    
    if (user) {
        if (user.password === password) {
            this.currentUser.set(uid);
            localStorage.setItem('supabase_session_user', uid);
            this.updateHeartbeat();
            return true;
        }
        return false;
    } else {
        // Register
        const { error } = await this.supabase.from('app_users').insert({ uid, password });
        if (error) { console.error(error); return false; }
        
        await this.supabase.from('profiles').insert({
            uid, avatar: '', is_admin: registerAsAdmin, 
            admin_tag: registerAsAdmin ? (adminTag || '<管理员>') : null,
            last_active: Date.now()
        });

        this.currentUser.set(uid);
        localStorage.setItem('supabase_session_user', uid);
        this.sendNotification(uid, 'system', '欢迎来到期末祝福画板！');
        return true;
    }
  }

  logout() {
    this.currentUser.set(null);
    this.leaveBoard();
    this.showUserCenter.set(false);
    this.showChat.set(false);
    localStorage.removeItem('supabase_session_user');
  }

  async updateProfile(uid: string, avatarBase64: string) {
      await this.supabase.from('profiles').update({ avatar: avatarBase64 }).eq('uid', uid);
  }

  async updateChatBackground(bg: string) {
      const uid = this.currentUser();
      if (!uid) return;
      await this.supabase.from('profiles').update({ chat_background: bg }).eq('uid', uid);
  }

  private async updateHeartbeat() {
      const uid = this.currentUser();
      if (!uid) return;
      await this.supabase.from('profiles').update({ last_active: Date.now() }).eq('uid', uid);
  }

  isUserOnline(uid: string): boolean {
      const profile = this.allProfiles().find(p => p.uid === uid);
      return profile?.lastActive ? (Date.now() - profile.lastActive < 60000) : false;
  }
  
  getAvatar(uid: string): string | undefined {
    return this.allProfiles().find(p => p.uid === uid)?.avatar;
  }
  
  getUserProfile(uid: string): UserProfile | undefined {
      return this.allProfiles().find(p => p.uid === uid);
  }

  getAllUsers(): string[] { return this.allUserIds(); }

  // --- Social ---
  getLikeCount(targetId: string): number { return this.allLikes().filter(l => l.targetId === targetId).length; }
  
  hasLiked(targetId: string): boolean {
      const uid = this.currentUser();
      if (!uid) return false;
      const record = this.allLikes().find(l => l.targetId === targetId && l.userId === uid);
      if (!record) return false;
      if (record.targetType === 'user') return (Date.now() - record.timestamp) < 86400000;
      return true;
  }

  async toggleLike(targetId: string, type: 'board' | 'post' | 'user') {
      const uid = this.currentUser();
      if (!uid) return;
      
      const existing = this.allLikes().find(l => l.targetId === targetId && l.userId === uid);
      
      if (type === 'user') {
          if (existing && (Date.now() - existing.timestamp) < 86400000) {
              alert('每天只能给该用户点赞一次哦！');
              return;
          }
          if (existing) {
              await this.supabase.from('likes').update({ timestamp: Date.now() }).eq('id', existing.id);
          } else {
              await this.supabase.from('likes').insert({ id: crypto.randomUUID(), target_id: targetId, target_type: type, user_id: uid, timestamp: Date.now() });
          }
          this.sendNotification(targetId, 'like', `${uid} 给你的主页点赞了！`);
      } else {
          if (existing) {
              await this.supabase.from('likes').delete().eq('id', existing.id);
          } else {
              await this.supabase.from('likes').insert({ id: crypto.randomUUID(), target_id: targetId, target_type: type, user_id: uid, timestamp: Date.now() });
              // Notify
              let ownerId = '';
              let msg = '';
              if (type === 'board') {
                  const b = this.allBoards().find(x => x.id === targetId);
                  if (b) { ownerId = b.creator; msg = `${uid} 点赞了你的画板: ${b.title}`; }
              } else if (type === 'post') {
                  const p = this.allPosts().find(x => x.id === targetId);
                  if (p) { ownerId = p.author; msg = `${uid} 点赞了你的帖子: ${p.title}`; }
              }
              if (ownerId && ownerId !== uid) this.sendNotification(ownerId, 'like', msg, type === 'post' ? undefined : targetId);
          }
      }
  }

  isFollowing(targetUid: string): boolean {
      const uid = this.currentUser();
      if (!uid) return false;
      return this.allFollows().some(f => f.followerId === uid && f.followingId === targetUid);
  }
  
  getFollowerCount(uid: string): number { return this.allFollows().filter(f => f.followingId === uid).length; }
  getFollowingCount(uid: string): number { return this.allFollows().filter(f => f.followerId === uid).length; }

  async toggleFollow(targetUid: string) {
      const uid = this.currentUser();
      if (!uid || uid === targetUid) return;
      const existing = this.allFollows().find(f => f.followerId === uid && f.followingId === targetUid);
      
      if (existing) {
          await this.supabase.from('follows').delete().eq('id', existing.id);
      } else {
          await this.supabase.from('follows').insert({ id: crypto.randomUUID(), follower_id: uid, following_id: targetUid, timestamp: Date.now() });
          this.sendNotification(targetUid, 'follow', `${uid} 关注了你！`);
      }
  }

  async sendNotification(recipientId: string, type: Notification['type'], content: string, linkTo?: string) {
      await this.supabase.from('notifications').insert({
          id: crypto.randomUUID(), recipient_id: recipientId, type,
          title: this.getNotifTitle(type), content, link_to: linkTo,
          is_read: false, timestamp: Date.now()
      });
  }
  
  private getNotifTitle(type: string): string {
      switch(type) {
          case 'like': return '收到点赞';
          case 'follow': return '新增关注';
          case 'comment': return '收到评论';
          case 'board_update': return '画板更新';
          case 'pin': return '置顶通知';
          case 'system': return '系统通知';
          default: return '通知';
      }
  }

  async markNotificationRead(id: string) { await this.supabase.from('notifications').update({ is_read: true }).eq('id', id); }
  async markAllNotificationsRead() { 
      const uid = this.currentUser();
      if (uid) await this.supabase.from('notifications').update({ is_read: true }).eq('recipient_id', uid); 
  }

  // --- Boards Management ---
  async createBoard(title: string, isPrivate: boolean, backgroundColor: string = '#ffffff'): Promise<string> {
    const user = this.currentUser();
    if (!user) throw new Error('Auth required');
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    await this.supabase.from('boards').insert({
        id, title, creator: user, is_private: isPrivate, 
        background_color: backgroundColor, created_at: Date.now(), is_pinned: false
    });
    return id;
  }

  async joinBoard(boardId: string): Promise<boolean> {
    const { data: board } = await this.supabase.from('boards').select('id').eq('id', boardId).single();
    if (board) {
      this.currentBoardId.set(boardId);
      this.showUserCenter.set(false);
      localStorage.setItem('supabase_session_board', boardId);
      this.subscribeToBoardElements(boardId);
      return true;
    }
    return false;
  }

  leaveBoard() {
    this.currentBoardId.set(null);
    localStorage.removeItem('supabase_session_board');
    this.unsubscribeFromBoardElements();
  }

  async deleteBoard(boardId: string) {
    await this.supabase.from('boards').delete().eq('id', boardId);
    if (this.currentBoardId() === boardId) this.leaveBoard();
  }
  
  async togglePinBoard(boardId: string) {
      const b = this.allBoards().find(x => x.id === boardId);
      if (!b) return;
      await this.supabase.from('boards').update({ is_pinned: !b.isPinned }).eq('id', boardId);
      if (!b.isPinned) this.sendNotification(b.creator, 'pin', `恭喜！你的画板 "${b.title}" 被管理员置顶了！`, b.id);
  }

  async setBoardActiveVersion(boardId: string, versionId: string) {
      await this.supabase.from('boards').update({ active_version_id: versionId }).eq('id', boardId);
  }

  async addBoardItem(imageData: string) {
      const uid = this.currentUser();
      const bid = this.currentBoardId();
      if (!uid || !bid) return;
      await this.supabase.from('board_items').insert({
          id: crypto.randomUUID(), board_id: bid, author: uid, image_data: imageData, timestamp: Date.now()
      });
      // Notify
      const b = this.activeBoard();
      if (b && b.creator !== uid) this.sendNotification(b.creator, 'board_update', `${uid} 在你的画板 "${b.title}" 上增加了新内容！`, bid);
  }
  
  private getBoardItemCount(boardId: string): number { return this.allBlessings().filter(b => b.boardId === boardId).length; }

  async updateAnnouncement(text: string) {
      await this.supabase.from('global_config').upsert({ key: 'announcement', value: text });
  }

  // --- Realtime Canvas Elements ---
  private boardChannel: any = null;
  
  private async subscribeToBoardElements(boardId: string) {
      if (this.boardChannel) this.boardChannel.unsubscribe();
      this.currentBoardElements.set([]);

      const { data } = await this.supabase.from('canvas_elements').select('*').eq('board_id', boardId);
      if (data) this.currentBoardElements.set(data.map(this.mapCanvasElement));

      this.boardChannel = this.supabase.channel(`board:${boardId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'canvas_elements', filter: `board_id=eq.${boardId}` }, payload => {
            const { eventType, new: newRec, old: oldRec } = payload;
            if (eventType === 'INSERT') {
                this.currentBoardElements.update(el => [...el, this.mapCanvasElement(newRec)]);
            } else if (eventType === 'UPDATE') {
                this.currentBoardElements.update(el => el.map(e => e.id === newRec.id ? this.mapCanvasElement(newRec) : e));
            } else if (eventType === 'DELETE') {
                this.currentBoardElements.update(el => el.filter(e => e.id !== oldRec.id));
            }
        })
        .subscribe();
  }

  private unsubscribeFromBoardElements() {
      if (this.boardChannel) {
          this.boardChannel.unsubscribe();
          this.boardChannel = null;
      }
      this.currentBoardElements.set([]);
  }

  async upsertCanvasElement(el: CanvasElement) {
      // Convert camel to snake
      const dbRec = {
          id: el.id, board_id: el.boardId, type: el.type, x: el.x, y: el.y, author: el.author,
          width: el.width, height: el.height, content: el.content, color: el.color,
          font: el.font, font_size: el.fontSize, font_style_key: el.fontStyleKey,
          stroke_color: el.strokeColor, stroke_width: el.strokeWidth, image_src: el.imageSrc
      };
      await this.supabase.from('canvas_elements').upsert(dbRec);
  }

  async deleteCanvasElement(id: string) {
      await this.supabase.from('canvas_elements').delete().eq('id', id);
  }

  async clearCanvasElements(boardId: string) {
      await this.supabase.from('canvas_elements').delete().eq('board_id', boardId);
  }

  // --- Chat ---
  async sendMessage(content: string, receiver?: string, groupId?: string, type: 'text' | 'image' = 'text') {
      const sender = this.currentUser();
      if (!sender) return;
      await this.supabase.from('messages').insert({
          id: crypto.randomUUID(), sender, receiver, group_id: groupId, content, timestamp: Date.now(), type, read_by: [sender], is_recalled: false
      });
      this.updateHeartbeat();
  }

  async recallMessage(msgId: string) {
      await this.supabase.from('messages').update({ is_recalled: true }).eq('id', msgId);
  }

  async markMessagesAsRead(contactId?: string, groupId?: string) {
      const uid = this.currentUser();
      if (!uid) return;
      
      const unread = this.allMessages().filter(m => {
          let match = false;
          if (groupId && m.groupId === groupId) match = true;
          if (contactId && (m.sender === contactId || m.receiver === contactId) && !m.groupId) match = true;
          return match && !m.readBy?.includes(uid);
      });
      
      // Update one by one or optimized? One by one for now to keep it simple, or filter logic in DB.
      // Optimally we call a stored procedure or update where...
      // For this demo:
      for (const m of unread) {
          const newReadBy = [...(m.readBy || []), uid];
          // Update in DB
          await this.supabase.from('messages').update({ read_by: newReadBy }).eq('id', m.id);
      }
  }

  getUnreadCountFor(contactId?: string, groupId?: string): number {
      const uid = this.currentUser();
      if (!uid) return 0;
      return this.allMessages().filter(m => {
          if (m.sender === uid) return false;
          let match = false;
          if (groupId && m.groupId === groupId) match = true;
          if (contactId && m.sender === contactId && !m.groupId && m.receiver === uid) match = true;
          return match && !m.readBy?.includes(uid);
      }).length;
  }

  async createGroup(name: string): Promise<string> {
      const creator = this.currentUser();
      if (!creator) throw new Error('Auth');
      const id = crypto.randomUUID();
      await this.supabase.from('chat_groups').insert({ id, name, creator, members: [creator] });
      return id;
  }

  async joinGroup(groupId: string) {
      const uid = this.currentUser();
      const group = this.allGroups().find(g => g.id === groupId);
      if (!uid || !group || group.members.includes(uid)) return;
      const newMembers = [...group.members, uid];
      await this.supabase.from('chat_groups').update({ members: newMembers }).eq('id', groupId);
  }

  getMessagesFor(contactId?: string, groupId?: string) {
      const uid = this.currentUser();
      if (!uid) return [];
      return this.allMessages().filter(m => {
          if (groupId) return m.groupId === groupId;
          if (contactId) return (m.sender === uid && m.receiver === contactId) || (m.sender === contactId && m.receiver === uid);
          return false;
      }).sort((a, b) => a.timestamp - b.timestamp);
  }

  getMyGroups() {
      const uid = this.currentUser();
      return uid ? this.allGroups().filter(g => g.members.includes(uid)) : [];
  }
  
  getAllPublicGroups() { return this.allGroups(); }

  // --- Forum ---
  async createPost(title: string, content: string) {
      const author = this.currentUser();
      if (!author) return;
      await this.supabase.from('forum_posts').insert({
          id: crypto.randomUUID(), author, title, content, is_pinned: false, timestamp: Date.now()
      });
      this.updateHeartbeat();
  }

  async deletePost(postId: string) {
      await this.supabase.from('forum_posts').delete().eq('id', postId);
      // Comments cascade delete
  }

  async togglePinPost(postId: string) {
      const p = this.allPosts().find(x => x.id === postId);
      if (!p) return;
      await this.supabase.from('forum_posts').update({ is_pinned: !p.isPinned }).eq('id', postId);
      if (!p.isPinned) this.sendNotification(p.author, 'pin', `你的帖子 "${p.title}" 被置顶了！`);
  }

  async addComment(postId: string, content: string) {
      const author = this.currentUser();
      if (!author) return;
      await this.supabase.from('forum_comments').insert({
          id: crypto.randomUUID(), post_id: postId, author, content, timestamp: Date.now()
      });
      
      const p = this.allPosts().find(x => x.id === postId);
      if (p && p.author !== author) {
          this.sendNotification(p.author, 'comment', `${author} 评论了你的帖子: ${p.title}`);
      }
      this.updateHeartbeat();
  }
}