import { Injectable, signal, computed, effect } from '@angular/core';

export interface Board {
  id: string;
  title: string;
  creator: string;
  isPrivate: boolean; 
  backgroundColor?: string; 
  createdAt: number;
  activeVersionId?: string;
  isPinned?: boolean;
}

export interface BoardItem {
  id: string;
  boardId: string;
  author: string;
  imageData: string; 
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  avatar?: string;
  isAdmin?: boolean;
  adminTag?: string;
  lastActive?: number; 
  chatBackground?: string; 
}

export interface ChatMessage {
  id: string;
  sender: string;
  receiver?: string;
  groupId?: string;
  content: string;
  timestamp: number;
  type?: 'text' | 'image'; 
  readBy?: string[]; 
  isRecalled?: boolean; 
}

export interface ChatGroup {
  id: string;
  name: string;
  creator: string;
  members: string[]; 
}

export interface ForumPost {
  id: string;
  author: string;
  title: string;
  content: string;
  isPinned?: boolean;
  timestamp: number;
  comments: ForumComment[];
}

export interface ForumComment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
}

// --- NEW SOCIAL INTERFACES ---

export interface LikeRecord {
  id: string;
  targetId: string; // BoardID, PostID, or UserID
  targetType: 'board' | 'post' | 'user';
  userId: string; // Who liked
  timestamp: number;
}

export interface FollowRecord {
  id: string;
  followerId: string;
  followingId: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: 'system' | 'like' | 'follow' | 'comment' | 'board_update' | 'pin';
  title: string;
  content: string;
  linkTo?: string; // e.g., boardId or 'post:postId'
  isRead: boolean;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly BLESSINGS_KEY = 'finals_blessings_v2';
  private readonly BOARDS_KEY = 'finals_boards_v2';
  private readonly USERS_KEY = 'finals_users_v2';
  private readonly PROFILES_KEY = 'finals_profiles_v2';
  private readonly MESSAGES_KEY = 'finals_messages_v2';
  private readonly GROUPS_KEY = 'finals_groups_v2';
  private readonly POSTS_KEY = 'finals_posts_v2';
  private readonly ANNOUNCEMENT_KEY = 'finals_announcement_v2';
  
  // New Keys
  private readonly LIKES_KEY = 'finals_likes_v2';
  private readonly FOLLOWS_KEY = 'finals_follows_v2';
  private readonly NOTIFICATIONS_KEY = 'finals_notifications_v2';

  // Session Persistence Keys
  private readonly SESSION_USER_KEY = 'finals_session_user_v2';
  private readonly SESSION_BOARD_KEY = 'finals_session_board_v2';
  
  // State
  currentUser = signal<string | null>(null);
  currentBoardId = signal<string | null>(null);
  showUserCenter = signal<boolean>(false);
  showChat = signal<boolean>(false);
  announcement = signal<string>('');
  
  // Sorting Preferences
  boardSortMethod = signal<'new' | 'hot'>('hot');
  postSortMethod = signal<'new' | 'hot'>('hot');

  // Data Signals
  private allBlessings = signal<BoardItem[]>([]);
  private allBoards = signal<Board[]>([]);
  private allProfiles = signal<UserProfile[]>([]);
  private allMessages = signal<ChatMessage[]>([]);
  private allGroups = signal<ChatGroup[]>([]);
  private allPosts = signal<ForumPost[]>([]);
  private allUserIds = signal<string[]>([]);
  
  // New Data Signals
  private allLikes = signal<LikeRecord[]>([]);
  private allFollows = signal<FollowRecord[]>([]);
  private allNotifications = signal<Notification[]>([]);

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
      // Pinned always on top
      if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
      
      if (method === 'new') {
        return b.createdAt - a.createdAt;
      } else {
        // Hot score: Likes * 2 + Drawing Count
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
    const posts = [...this.allPosts()];

    return posts.sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;

      if (method === 'new') {
        return b.timestamp - a.timestamp;
      } else {
        // Hot score: Likes * 2 + Comments
        const scoreA = (this.getLikeCount(a.id) * 2) + a.comments.length;
        const scoreB = (this.getLikeCount(b.id) * 2) + b.comments.length;
        return scoreB - scoreA;
      }
    });
  });

  // Notifications for current user
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

  // Leaderboards
  userRankings = computed(() => {
      // Compute score for each user
      const stats = this.allUserIds().map(uid => {
          const followers = this.allFollows().filter(f => f.followingId === uid).length;
          const likesReceived = this.allLikes().filter(l => l.targetType === 'user' && l.targetId === uid).length;
          // Calculate total likes on their boards/posts could be expensive, sticking to direct user likes for "Karma"
          return { uid, followers, likesReceived };
      });

      return {
          byFollowers: [...stats].sort((a, b) => b.followers - a.followers).slice(0, 10),
          byLikes: [...stats].sort((a, b) => b.likesReceived - a.likesReceived).slice(0, 10)
      };
  });

  // Unread Counts (Chat)
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
    this.loadFromStorage();
    
    // Heartbeat for online status (every 30s)
    setInterval(() => {
        if (this.currentUser()) {
            this.updateHeartbeat();
        }
    }, 30000);

    window.addEventListener('storage', (event) => {
      this.loadFromStorage();
    });
  }

  // --- Helpers to safely save ---
  private safeSave(key: string, data: any) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        alert('本地存储空间已满！保存失败。');
      } else {
        console.error('Save failed', e);
      }
    }
  }

  // --- Auth & User ---
  authenticate(uid: string, password: string, registerAsAdmin: boolean = false, adminTag: string = ''): boolean {
    try {
      const usersStr = localStorage.getItem(this.USERS_KEY);
      const users = usersStr ? JSON.parse(usersStr) : {};

      if (users[uid]) {
        if (users[uid] === password) {
          this.currentUser.set(uid);
          localStorage.setItem(this.SESSION_USER_KEY, uid); // Persist Session
          this.updateHeartbeat();
          return true;
        } else {
          return false;
        }
      } else {
        users[uid] = password;
        this.safeSave(this.USERS_KEY, users);
        this.currentUser.set(uid);
        localStorage.setItem(this.SESSION_USER_KEY, uid); // Persist Session
        this.loadUserIds();
        
        const profile: UserProfile = { 
          uid, 
          avatar: '',
          isAdmin: registerAsAdmin,
          adminTag: registerAsAdmin ? (adminTag || '<管理员>') : undefined,
          lastActive: Date.now(),
          chatBackground: ''
        };
        
        this.allProfiles.update(prev => [...prev, profile]);
        this.saveProfiles();
        
        // System Welcome Notification
        this.sendNotification(uid, 'system', '欢迎来到期末祝福画板！');
        
        return true;
      }
    } catch (e) {
      console.error('Auth error', e);
      return false;
    }
  }

  logout() {
    this.currentUser.set(null);
    this.currentBoardId.set(null);
    this.showUserCenter.set(false);
    this.showChat.set(false);
    
    // Clear Session Persistence
    localStorage.removeItem(this.SESSION_USER_KEY);
    localStorage.removeItem(this.SESSION_BOARD_KEY);
  }

  updateProfile(uid: string, avatarBase64: string) {
    this.allProfiles.update(profiles => {
      const existing = profiles.find(p => p.uid === uid);
      if (existing) {
        return profiles.map(p => p.uid === uid ? { ...p, avatar: avatarBase64 } : p);
      } else {
        return [...profiles, { uid, avatar: avatarBase64 }];
      }
    });
    this.saveProfiles();
  }

  updateChatBackground(background: string) {
      const uid = this.currentUser();
      if (!uid) return;
      this.allProfiles.update(profiles => 
          profiles.map(p => p.uid === uid ? { ...p, chatBackground: background } : p)
      );
      this.saveProfiles();
  }

  private updateHeartbeat() {
      const uid = this.currentUser();
      if (!uid) return;
      this.allProfiles.update(profiles => 
          profiles.map(p => p.uid === uid ? { ...p, lastActive: Date.now() } : p)
      );
      this.saveProfiles();
  }

  isUserOnline(uid: string): boolean {
      const profile = this.allProfiles().find(p => p.uid === uid);
      if (!profile || !profile.lastActive) return false;
      // Online if active in last 60 seconds
      return (Date.now() - profile.lastActive) < 60000; 
  }

  getAvatar(uid: string): string | undefined {
    return this.allProfiles().find(p => p.uid === uid)?.avatar;
  }
  
  getUserProfile(uid: string): UserProfile | undefined {
      return this.allProfiles().find(p => p.uid === uid);
  }

  getAllUsers(): string[] {
    return this.allUserIds();
  }

  // --- SOCIAL: Likes & Follows ---

  getLikeCount(targetId: string): number {
      return this.allLikes().filter(l => l.targetId === targetId).length;
  }
  
  hasLiked(targetId: string): boolean {
      const uid = this.currentUser();
      if (!uid) return false;
      const record = this.allLikes().find(l => l.targetId === targetId && l.userId === uid);
      
      if (!record) return false;

      // For users, check 24h rule. For boards/posts, existence means liked.
      if (record.targetType === 'user') {
          return (Date.now() - record.timestamp) < 86400000; // 24 hours
      }
      return true;
  }

  toggleLike(targetId: string, type: 'board' | 'post' | 'user') {
      const uid = this.currentUser();
      if (!uid) return;

      const existingIndex = this.allLikes().findIndex(l => l.targetId === targetId && l.userId === uid);
      
      if (type === 'user') {
          // Special logic: User likes are daily
          if (existingIndex > -1) {
              const record = this.allLikes()[existingIndex];
              if ((Date.now() - record.timestamp) < 86400000) {
                  alert('每天只能给该用户点赞一次哦！');
                  return;
              }
              // Update timestamp (re-like after 24h)
              this.allLikes.update(likes => {
                  const newLikes = [...likes];
                  newLikes[existingIndex] = { ...record, timestamp: Date.now() };
                  return newLikes;
              });
              this.sendNotification(targetId, 'like', `${uid} 给你的主页点赞了！`);
          } else {
              // New like
               const newLike: LikeRecord = {
                  id: crypto.randomUUID(),
                  targetId,
                  targetType: type,
                  userId: uid,
                  timestamp: Date.now()
              };
              this.allLikes.update(l => [...l, newLike]);
              this.sendNotification(targetId, 'like', `${uid} 给你的主页点赞了！`);
          }
      } else {
          // Board/Post toggle
          if (existingIndex > -1) {
              // Remove
              this.allLikes.update(l => l.filter((_, i) => i !== existingIndex));
          } else {
              // Add
              const newLike: LikeRecord = {
                  id: crypto.randomUUID(),
                  targetId,
                  targetType: type,
                  userId: uid,
                  timestamp: Date.now()
              };
              this.allLikes.update(l => [...l, newLike]);
              
              // Notify owner
              let ownerId = '';
              let msg = '';
              if (type === 'board') {
                  const b = this.allBoards().find(x => x.id === targetId);
                  if (b) { ownerId = b.creator; msg = `${uid} 点赞了你的画板: ${b.title}`; }
              } else if (type === 'post') {
                  const p = this.allPosts().find(x => x.id === targetId);
                  if (p) { ownerId = p.author; msg = `${uid} 点赞了你的帖子: ${p.title}`; }
              }
              
              if (ownerId && ownerId !== uid) {
                  this.sendNotification(ownerId, 'like', msg, type === 'post' ? undefined : targetId);
              }
          }
      }
      this.saveLikes();
  }

  isFollowing(targetUid: string): boolean {
      const uid = this.currentUser();
      if (!uid) return false;
      return this.allFollows().some(f => f.followerId === uid && f.followingId === targetUid);
  }
  
  getFollowerCount(uid: string): number {
      return this.allFollows().filter(f => f.followingId === uid).length;
  }
  
  getFollowingCount(uid: string): number {
      return this.allFollows().filter(f => f.followerId === uid).length;
  }

  toggleFollow(targetUid: string) {
      const uid = this.currentUser();
      if (!uid || uid === targetUid) return;

      const existing = this.allFollows().find(f => f.followerId === uid && f.followingId === targetUid);
      if (existing) {
          // Unfollow
          this.allFollows.update(arr => arr.filter(f => f.id !== existing.id));
      } else {
          // Follow
          const newFollow: FollowRecord = {
              id: crypto.randomUUID(),
              followerId: uid,
              followingId: targetUid,
              timestamp: Date.now()
          };
          this.allFollows.update(arr => [...arr, newFollow]);
          this.sendNotification(targetUid, 'follow', `${uid} 关注了你！`);
      }
      this.saveFollows();
  }

  // --- NOTIFICATIONS ---

  sendNotification(recipientId: string, type: Notification['type'], content: string, linkTo?: string) {
      const newNotif: Notification = {
          id: crypto.randomUUID(),
          recipientId,
          type,
          title: this.getNotifTitle(type),
          content,
          linkTo,
          isRead: false,
          timestamp: Date.now()
      };
      this.allNotifications.update(n => [newNotif, ...n]);
      this.saveNotifications();
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

  markNotificationRead(id: string) {
      this.allNotifications.update(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
      this.saveNotifications();
  }
  
  markAllNotificationsRead() {
      const uid = this.currentUser();
      if (!uid) return;
      this.allNotifications.update(ns => ns.map(n => n.recipientId === uid ? { ...n, isRead: true } : n));
      this.saveNotifications();
  }

  // --- Boards ---
  createBoard(title: string, isPrivate: boolean, backgroundColor: string = '#ffffff'): string {
    const user = this.currentUser();
    if (!user) throw new Error('Must be logged in');

    const newBoard: Board = {
      id: Math.random().toString(36).substring(2, 8).toUpperCase(),
      title,
      creator: user,
      isPrivate,
      backgroundColor,
      createdAt: Date.now(),
      isPinned: false
    };

    this.allBoards.update(prev => [newBoard, ...prev]);
    this.saveBoards();
    return newBoard.id;
  }

  joinBoard(boardId: string): boolean {
    const board = this.allBoards().find(b => b.id === boardId);
    if (board) {
      this.currentBoardId.set(boardId);
      this.showUserCenter.set(false);
      localStorage.setItem(this.SESSION_BOARD_KEY, boardId); // Persist Active Board
      return true;
    }
    return false;
  }

  leaveBoard() {
    this.currentBoardId.set(null);
    localStorage.removeItem(this.SESSION_BOARD_KEY); // Clear Active Board
  }

  deleteBoard(boardId: string) {
    this.allBoards.update(prev => prev.filter(b => b.id !== boardId));
    this.allBlessings.update(prev => prev.filter(i => i.boardId !== boardId));
    // Remove related likes
    this.allLikes.update(l => l.filter(x => !(x.targetType === 'board' && x.targetId === boardId)));
    
    // If deleted board was active, leave it
    if (this.currentBoardId() === boardId) {
        this.leaveBoard();
    }
    
    this.saveBoards();
    this.saveBlessings();
    this.saveLikes();
  }
  
  togglePinBoard(boardId: string) {
      this.allBoards.update(boards => boards.map(b => {
          if (b.id === boardId) {
              const newVal = !b.isPinned;
              if (newVal) {
                  this.sendNotification(b.creator, 'pin', `恭喜！你的画板 "${b.title}" 被管理员置顶了！`, b.id);
              }
              return { ...b, isPinned: newVal };
          }
          return b;
      }));
      this.saveBoards();
  }

  setBoardActiveVersion(boardId: string, versionId: string) {
    this.allBoards.update(boards => 
      boards.map(b => b.id === boardId ? { ...b, activeVersionId: versionId } : b)
    );
    this.saveBoards();
  }

  addBoardItem(imageData: string) {
    const user = this.currentUser();
    const boardId = this.currentBoardId();
    if (!user || !boardId) return;

    const newItem: BoardItem = {
      id: crypto.randomUUID(),
      boardId,
      author: user,
      imageData,
      timestamp: Date.now()
    };

    this.allBlessings.update(prev => [newItem, ...prev]);
    this.saveBlessings();

    // Notify Board Creator if someone else draws
    const board = this.allBoards().find(b => b.id === boardId);
    if (board && board.creator !== user) {
        this.sendNotification(board.creator, 'board_update', `${user} 在你的画板 "${board.title}" 上增加了新内容！`, boardId);
    }
  }
  
  private getBoardItemCount(boardId: string): number {
      return this.allBlessings().filter(b => b.boardId === boardId).length;
  }

  // --- Announcement ---
  updateAnnouncement(text: string) {
      this.announcement.set(text);
      localStorage.setItem(this.ANNOUNCEMENT_KEY, text);
  }

  // --- Chat ---
  sendMessage(content: string, receiver?: string, groupId?: string, type: 'text' | 'image' = 'text') {
    const sender = this.currentUser();
    if (!sender) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender,
      receiver,
      groupId,
      content, // base64 if type is image
      timestamp: Date.now(),
      type,
      readBy: [sender], // Sender has read it
      isRecalled: false
    };

    this.allMessages.update(msgs => [...msgs, msg]);
    this.saveMessages();
    this.updateHeartbeat();
  }

  recallMessage(msgId: string) {
      this.allMessages.update(msgs => msgs.map(m => {
          if (m.id === msgId) {
              return { ...m, isRecalled: true };
          }
          return m;
      }));
      this.saveMessages();
  }

  markMessagesAsRead(contactId?: string, groupId?: string) {
      const uid = this.currentUser();
      if (!uid) return;

      this.allMessages.update(msgs => msgs.map(m => {
          let shouldMark = false;
          if (groupId && m.groupId === groupId) shouldMark = true;
          if (contactId && (m.sender === contactId || m.receiver === contactId) && !m.groupId) shouldMark = true;

          if (shouldMark && !m.readBy?.includes(uid)) {
              return { ...m, readBy: [...(m.readBy || []), uid] };
          }
          return m;
      }));
      this.saveMessages();
  }

  getUnreadCountFor(contactId?: string, groupId?: string): number {
      const uid = this.currentUser();
      if (!uid) return 0;

      return this.allMessages().filter(m => {
          // Must not be mine
          if (m.sender === uid) return false;
          
          let match = false;
          if (groupId && m.groupId === groupId) match = true;
          if (contactId && m.sender === contactId && !m.groupId && m.receiver === uid) match = true; // Only incoming DM

          return match && !m.readBy?.includes(uid);
      }).length;
  }

  createGroup(name: string): string {
    const creator = this.currentUser();
    if (!creator) throw new Error('Not logged in');
    
    const group: ChatGroup = {
      id: crypto.randomUUID(),
      name,
      creator,
      members: [creator]
    };
    
    this.allGroups.update(gs => [...gs, group]);
    this.saveGroups();
    return group.id;
  }

  joinGroup(groupId: string) {
    const uid = this.currentUser();
    if (!uid) return;
    
    this.allGroups.update(gs => gs.map(g => {
        if (g.id === groupId && !g.members.includes(uid)) {
            return { ...g, members: [...g.members, uid] };
        }
        return g;
    }));
    this.saveGroups();
  }

  getMessagesFor(contactId?: string, groupId?: string) {
    const uid = this.currentUser();
    if (!uid) return [];
    
    return this.allMessages().filter(m => {
      if (groupId) {
        return m.groupId === groupId;
      }
      if (contactId) {
        // Private chat: either I sent to them, or they sent to me
        return (m.sender === uid && m.receiver === contactId) ||
               (m.sender === contactId && m.receiver === uid);
      }
      return false;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  getMyGroups() {
    const uid = this.currentUser();
    if (!uid) return [];
    return this.allGroups().filter(g => g.members.includes(uid));
  }
  
  getAllPublicGroups() {
      // For simplicity, all groups are public to join in this demo
      return this.allGroups();
  }

  // --- Forum ---
  createPost(title: string, content: string) {
    const author = this.currentUser();
    if (!author) return;

    const post: ForumPost = {
      id: crypto.randomUUID(),
      author,
      title,
      content,
      timestamp: Date.now(),
      isPinned: false,
      comments: []
    };
    
    this.allPosts.update(posts => [post, ...posts]);
    this.savePosts();
    this.updateHeartbeat();
  }

  deletePost(postId: string) {
      this.allPosts.update(posts => posts.filter(p => p.id !== postId));
      // Clean up likes
      this.allLikes.update(l => l.filter(x => !(x.targetType === 'post' && x.targetId === postId)));
      this.savePosts();
      this.saveLikes();
  }

  togglePinPost(postId: string) {
      this.allPosts.update(posts => posts.map(p => {
          if (p.id === postId) {
              const newVal = !p.isPinned;
              if (newVal) {
                  this.sendNotification(p.author, 'pin', `你的帖子 "${p.title}" 被置顶了！`);
              }
              return { ...p, isPinned: newVal };
          }
          return p;
      }));
      this.savePosts();
  }

  addComment(postId: string, content: string) {
    const author = this.currentUser();
    if (!author) return;

    const comment: ForumComment = {
      id: crypto.randomUUID(),
      author,
      content,
      timestamp: Date.now()
    };

    let postAuthor = '';

    this.allPosts.update(posts => posts.map(p => {
      if (p.id === postId) {
        postAuthor = p.author;
        return { ...p, comments: [...p.comments, comment] };
      }
      return p;
    }));
    
    this.savePosts();
    this.updateHeartbeat();

    // Notify Post Author
    if (postAuthor && postAuthor !== author) {
        const postTitle = this.allPosts().find(p => p.id === postId)?.title || '帖子';
        this.sendNotification(postAuthor, 'comment', `${author} 评论了你的帖子: ${postTitle}`);
    }
  }

  // --- Storage ---
  private loadFromStorage() {
    try {
      this.loadUserIds();
      
      const storedBlessings = localStorage.getItem(this.BLESSINGS_KEY);
      if (storedBlessings) this.allBlessings.set(JSON.parse(storedBlessings));

      const storedBoards = localStorage.getItem(this.BOARDS_KEY);
      if (storedBoards) this.allBoards.set(JSON.parse(storedBoards));

      const storedProfiles = localStorage.getItem(this.PROFILES_KEY);
      if (storedProfiles) this.allProfiles.set(JSON.parse(storedProfiles));

      const storedMessages = localStorage.getItem(this.MESSAGES_KEY);
      if (storedMessages) this.allMessages.set(JSON.parse(storedMessages));

      const storedGroups = localStorage.getItem(this.GROUPS_KEY);
      if (storedGroups) this.allGroups.set(JSON.parse(storedGroups));

      const storedPosts = localStorage.getItem(this.POSTS_KEY);
      if (storedPosts) this.allPosts.set(JSON.parse(storedPosts));
      
      const storedAnnouncement = localStorage.getItem(this.ANNOUNCEMENT_KEY);
      if (storedAnnouncement) this.announcement.set(storedAnnouncement);
      
      const storedLikes = localStorage.getItem(this.LIKES_KEY);
      if (storedLikes) this.allLikes.set(JSON.parse(storedLikes));
      
      const storedFollows = localStorage.getItem(this.FOLLOWS_KEY);
      if (storedFollows) this.allFollows.set(JSON.parse(storedFollows));
      
      const storedNotifs = localStorage.getItem(this.NOTIFICATIONS_KEY);
      if (storedNotifs) this.allNotifications.set(JSON.parse(storedNotifs));

      // --- RESTORE SESSION ---
      const sessionUser = localStorage.getItem(this.SESSION_USER_KEY);
      if (sessionUser) {
          // Ideally verify user exists, but simple restoration is fine
          this.currentUser.set(sessionUser);
          this.updateHeartbeat();
      }

      const sessionBoard = localStorage.getItem(this.SESSION_BOARD_KEY);
      if (sessionBoard) {
          if (this.allBoards().some(b => b.id === sessionBoard)) {
              this.currentBoardId.set(sessionBoard);
          } else {
              localStorage.removeItem(this.SESSION_BOARD_KEY);
          }
      }

    } catch (e) {
      console.error('Failed to load data', e);
    }
  }

  private loadUserIds() {
      const usersStr = localStorage.getItem(this.USERS_KEY);
      if (usersStr) {
          this.allUserIds.set(Object.keys(JSON.parse(usersStr)));
      }
  }

  private saveBlessings() { this.safeSave(this.BLESSINGS_KEY, this.allBlessings()); }
  private saveBoards() { this.safeSave(this.BOARDS_KEY, this.allBoards()); }
  private saveProfiles() { this.safeSave(this.PROFILES_KEY, this.allProfiles()); }
  private saveMessages() { this.safeSave(this.MESSAGES_KEY, this.allMessages()); }
  private saveGroups() { this.safeSave(this.GROUPS_KEY, this.allGroups()); }
  private savePosts() { this.safeSave(this.POSTS_KEY, this.allPosts()); }
  private saveLikes() { this.safeSave(this.LIKES_KEY, this.allLikes()); }
  private saveFollows() { this.safeSave(this.FOLLOWS_KEY, this.allFollows()); }
  private saveNotifications() { this.safeSave(this.NOTIFICATIONS_KEY, this.allNotifications()); }
}