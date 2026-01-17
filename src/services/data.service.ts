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
  lastActive?: number; // New: For Online Status
  chatBackground?: string; // New: Custom Chat Background (color hex or image url)
}

export interface ChatMessage {
  id: string;
  sender: string;
  receiver?: string;
  groupId?: string;
  content: string;
  timestamp: number;
  type?: 'text' | 'image'; // New: Message Type
  readBy?: string[]; // New: Array of UIDs who read the message
  isRecalled?: boolean; // New: Recall status
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
  
  // Session Persistence Keys
  private readonly SESSION_USER_KEY = 'finals_session_user_v2';
  private readonly SESSION_BOARD_KEY = 'finals_session_board_v2';
  
  // State
  currentUser = signal<string | null>(null);
  currentBoardId = signal<string | null>(null);
  showUserCenter = signal<boolean>(false);
  showChat = signal<boolean>(false);
  
  // Data Signals
  private allBlessings = signal<BoardItem[]>([]);
  private allBoards = signal<Board[]>([]);
  private allProfiles = signal<UserProfile[]>([]);
  private allMessages = signal<ChatMessage[]>([]);
  private allGroups = signal<ChatGroup[]>([]);
  private allPosts = signal<ForumPost[]>([]);
  private allUserIds = signal<string[]>([]);

  // --- Computed ---

  activeBoard = computed(() => 
    this.allBoards().find(b => b.id === this.currentBoardId())
  );

  currentBoardBlessings = computed(() => 
    this.allBlessings()
      .filter(b => b.boardId === this.currentBoardId())
      .sort((a, b) => b.timestamp - a.timestamp)
  );

  publicBoards = computed(() => 
    this.allBoards()
      .filter(b => !b.isPrivate)
      .sort((a, b) => {
        if (!!a.isPinned !== !!b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
      })
  );

  myBoards = computed(() => 
    this.allBoards()
      .filter(b => b.creator === this.currentUser())
      .sort((a, b) => b.createdAt - a.createdAt)
  );

  currentUserProfile = computed(() => 
    this.allProfiles().find(p => p.uid === this.currentUser())
  );

  isAdmin = computed(() => !!this.currentUserProfile()?.isAdmin);
  
  posts = computed(() => 
    this.allPosts().sort((a, b) => {
      if (a.isPinned === b.isPinned) {
        return b.timestamp - a.timestamp;
      }
      return a.isPinned ? -1 : 1;
    })
  );

  // Unread Counts
  totalUnreadCount = computed(() => {
    const uid = this.currentUser();
    if (!uid) return 0;
    return this.allMessages().filter(m => {
      // Logic: I am the receiver OR it's a group I'm in (handled by getMessagesFor context usually, but here global)
      // Simpler: If I am not the sender, and I haven't read it.
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
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
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
    
    // If deleted board was active, leave it
    if (this.currentBoardId() === boardId) {
        this.leaveBoard();
    }
    
    this.saveBoards();
    this.saveBlessings();
  }
  
  togglePinBoard(boardId: string) {
      this.allBoards.update(boards => boards.map(b => {
          if (b.id === boardId) {
              return { ...b, isPinned: !b.isPinned };
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
      this.savePosts();
  }

  togglePinPost(postId: string) {
      this.allPosts.update(posts => posts.map(p => {
          if (p.id === postId) {
              return { ...p, isPinned: !p.isPinned };
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

    this.allPosts.update(posts => posts.map(p => {
      if (p.id === postId) {
        return { ...p, comments: [...p.comments, comment] };
      }
      return p;
    }));
    this.savePosts();
    this.updateHeartbeat();
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

  private saveBlessings() { localStorage.setItem(this.BLESSINGS_KEY, JSON.stringify(this.allBlessings())); }
  private saveBoards() { localStorage.setItem(this.BOARDS_KEY, JSON.stringify(this.allBoards())); }
  private saveProfiles() { localStorage.setItem(this.PROFILES_KEY, JSON.stringify(this.allProfiles())); }
  private saveMessages() { localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(this.allMessages())); }
  private saveGroups() { localStorage.setItem(this.GROUPS_KEY, JSON.stringify(this.allGroups())); }
  private savePosts() { localStorage.setItem(this.POSTS_KEY, JSON.stringify(this.allPosts())); }
}