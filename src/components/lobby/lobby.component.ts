import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormControl, FormGroup, FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="h-full bg-gray-50 flex flex-col p-4 md:p-8 overflow-y-auto">
      <div class="max-w-6xl mx-auto w-full flex-1">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div class="flex items-center gap-6">
            <h1 class="text-3xl font-bold text-gray-900">
              @if (activeTab() === 'hall') { 画板大厅 } @else { 公共讨论区 }
            </h1>
            
            <!-- Main Navigation Tabs -->
            <div class="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
               <button 
                 (click)="activeTab.set('hall')" 
                 class="px-4 py-2 rounded-md text-sm font-bold transition-all"
                 [class.bg-gray-100]="activeTab() === 'hall'"
                 [class.text-indigo-600]="activeTab() === 'hall'"
                 [class.text-gray-500]="activeTab() !== 'hall'">
                 画板
               </button>
               <button 
                 (click)="activeTab.set('forum')" 
                 class="px-4 py-2 rounded-md text-sm font-bold transition-all"
                 [class.bg-gray-100]="activeTab() === 'forum'"
                 [class.text-indigo-600]="activeTab() === 'forum'"
                 [class.text-gray-500]="activeTab() !== 'forum'">
                 讨论
               </button>
            </div>
          </div>

          <div class="flex flex-col items-end gap-2">
             <div class="flex items-center gap-3">
                <!-- Chat Button -->
                <button (click)="toggleChat()" class="relative bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full transition-colors" title="聊天">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    @if (unreadCount() > 0) {
                       <span class="absolute -top-1 -right-1 flex h-3 w-3">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] flex items-center justify-center font-bold"></span>
                       </span>
                    }
                </button>

                <div class="h-6 w-px bg-gray-300 mx-2"></div>

                <span class="text-sm font-medium">你好, {{ dataService.currentUser() }}</span>
                <button (click)="goToUserCenter()" class="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm text-gray-800 transition-colors flex items-center gap-1">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                   个人中心
                </button>
                <button (click)="dataService.logout()" class="text-xs text-red-500 hover:text-red-700 underline ml-2">退出</button>
             </div>
          </div>
        </div>

        <!-- CONTENT: Board Hall -->
        @if (activeTab() === 'hall') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            <!-- Left: Create & Join -->
            <div class="space-y-6">
              <!-- Create Board -->
              <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                  创建新画板
                </h2>
                <form [formGroup]="createForm" (ngSubmit)="onCreate()">
                  <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">画板标题</label>
                    <input formControlName="title" type="text" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: 英语一班期末加油">
                  </div>
                  
                  <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">背景颜色</label>
                    <div class="flex gap-2">
                      @for (bg of backgroundOptions; track bg.value) {
                        <button 
                          type="button"
                          (click)="selectedBg.set(bg.value)"
                          [style.backgroundColor]="bg.value"
                          class="w-8 h-8 rounded-full border border-gray-300 shadow-sm transition-transform hover:scale-110 focus:outline-none"
                          [class.ring-2]="selectedBg() === bg.value"
                          [class.ring-indigo-500]="selectedBg() === bg.value"
                          [title]="bg.name">
                        </button>
                      }
                    </div>
                  </div>

                  <div class="mb-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input formControlName="isPrivate" type="checkbox" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                      <span class="text-sm text-gray-700">设为私有 (仅通过邀请码可见)</span>
                    </label>
                  </div>
                  <button type="submit" [disabled]="createForm.invalid" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
                    创建画板
                  </button>
                </form>
              </div>

              <!-- Join Private -->
              <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                  加入私有画板
                </h2>
                <div class="flex gap-2">
                  <input [formControl]="joinCodeControl" type="text" class="flex-1 px-3 py-2 border rounded-lg uppercase placeholder-gray-400 focus:ring-2 focus:ring-green-500 outline-none" placeholder="输入邀请码 (ID)">
                  <button (click)="onJoin()" class="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800">进入</button>
                </div>
                @if (joinError()) {
                  <p class="text-red-500 text-xs mt-2">{{ joinError() }}</p>
                }
              </div>
            </div>

            <!-- Right: Public Boards List -->
            <div class="lg:col-span-2">
              <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 class="text-lg font-bold flex items-center gap-2">
                  <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                  公共画板大厅
                </h2>
                <!-- Board Search -->
                <div class="relative w-full md:w-64">
                   <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                   </div>
                   <input [(ngModel)]="boardSearch" placeholder="搜索画板..." class="pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-indigo-500 outline-none">
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (board of filteredBoards(); track board.id) {
                  <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group relative"
                       [class.border-l-4]="board.isPinned" [class.border-l-indigo-500]="board.isPinned">
                    
                    @if (board.isPinned) {
                        <div class="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg rounded-tr-lg font-bold z-10">
                            置顶
                        </div>
                    }

                    <!-- Admin Actions -->
                    @if (isAdmin()) {
                       <div class="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" [class.mr-10]="board.isPinned">
                           <button (click)="toggleBoardPin(board.id); $event.stopPropagation()" class="text-xs p-1 rounded hover:bg-gray-100 text-gray-600" title="{{ board.isPinned ? '取消置顶' : '置顶' }}">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                           </button>
                           <button (click)="deleteBoard(board.id); $event.stopPropagation()" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="管理员删除">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                           </button>
                       </div>
                    }

                    <div (click)="enterBoard(board.id)">
                        <div class="flex justify-between items-start mb-2 pr-6">
                        <h3 class="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors truncate">{{ board.title }}</h3>
                        </div>
                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono">ID: {{ board.id }}</span>
                        <div class="flex items-center gap-2 text-sm text-gray-500 mt-2">
                        <span class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{{ board.creator.slice(0,2) }}</span>
                        <span>创建者: {{ board.creator }}</span>
                        </div>
                        <div class="mt-4 flex justify-between items-center text-xs text-gray-400">
                        <span>{{ board.createdAt | date:'shortDate' }}</span>
                        <span class="text-indigo-500 font-medium group-hover:underline">点击进入 &rarr;</span>
                        </div>
                    </div>
                  </div>
                }
                @if (filteredBoards().length === 0) {
                  <div class="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p class="text-gray-400">
                        @if (boardSearch) { 未找到匹配的画板 } @else { 暂无公共画板，快来创建一个吧！ }
                    </p>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- CONTENT: Public Forum (Moved from UserCenter) -->
        @if (activeTab() === 'forum') {
          <div class="max-w-4xl mx-auto animate-fade-in">
             <div class="flex gap-4 mb-6">
                <input [(ngModel)]="postTitle" placeholder="帖子标题" class="flex-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
                <button (click)="createPost()" [disabled]="!postTitle.trim()" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold shadow-sm transition-transform active:scale-95">发布帖子</button>
            </div>
            
            <textarea [(ngModel)]="postContent" placeholder="想和大家聊点什么？" class="w-full p-3 border rounded-lg mb-8 h-24 outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-sm"></textarea>

            <div class="space-y-6">
                @for (post of dataService.posts(); track post.id) {
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md relative" [class.border-l-4]="post.isPinned" [class.border-l-indigo-500]="post.isPinned">
                        
                        <!-- Pinned Badge -->
                        @if (post.isPinned) {
                            <div class="absolute top-0 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg font-bold flex items-center gap-1">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                                置顶
                            </div>
                        }

                        <!-- Admin Actions for Forum -->
                        @if (isAdmin()) {
                            <div class="absolute top-2 right-2 flex gap-1 items-center" [class.mr-14]="post.isPinned">
                                <button (click)="togglePin(post.id)" class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                                    {{ post.isPinned ? '取消置顶' : '置顶' }}
                                </button>
                                <button (click)="deletePost(post.id)" class="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
                                    删除
                                </button>
                            </div>
                        }

                        <div class="flex items-center gap-3 mb-4">
                           <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 relative">
                              @if (getAvatar(post.author)) { <img [src]="getAvatar(post.author)" class="w-full h-full object-cover"> } @else { <div class="w-full h-full flex items-center justify-center font-bold text-gray-500">{{post.author.slice(0,1)}}</div> }
                           </div>
                           <div>
                              <div class="flex items-center gap-2">
                                  <div class="font-bold text-gray-900">{{ post.title }}</div>
                                  <!-- Author Admin Tag -->
                                  @let tag = getAdminTag(post.author);
                                  @if (tag) {
                                      <span class="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded border border-purple-200 font-bold">{{ tag }}</span>
                                  }
                              </div>
                              <div class="text-xs text-gray-500">{{ post.author }} • {{ post.timestamp | date:'short' }}</div>
                           </div>
                        </div>
                        
                        <p class="text-gray-800 mb-6 whitespace-pre-wrap leading-relaxed">{{ post.content }}</p>

                        <!-- Comments Section -->
                        <div class="bg-gray-50 rounded-xl p-4">
                           <h4 class="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                             <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                             评论 ({{ post.comments.length }})
                           </h4>
                           @if (post.comments.length > 0) {
                             <div class="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                                @for (comment of post.comments; track comment.id) {
                                    <div class="flex gap-2 items-start text-sm group">
                                        <div class="w-6 h-6 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-[10px] text-indigo-700 font-bold mt-0.5">
                                          {{ comment.author.slice(0,1) }}
                                        </div>
                                        <div>
                                          <div class="flex items-center gap-1">
                                            <span class="font-bold text-gray-900">{{ comment.author }}:</span>
                                            @let commentTag = getAdminTag(comment.author);
                                            @if (commentTag) {
                                                <span class="bg-purple-50 text-purple-600 text-[9px] px-1 rounded border border-purple-100">{{ commentTag }}</span>
                                            }
                                          </div>
                                          <span class="text-gray-700 break-all">{{ comment.content }}</span>
                                          <span class="text-[10px] text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">{{ comment.timestamp | date:'shortTime' }}</span>
                                        </div>
                                    </div>
                                }
                             </div>
                           }
                           <div class="flex gap-2">
                               <input #commentInput (keydown.enter)="addComment(post.id, commentInput.value); commentInput.value=''" placeholder="写评论..." class="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                               <button (click)="addComment(post.id, commentInput.value); commentInput.value=''" class="text-sm bg-indigo-600 text-white border border-transparent px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">评论</button>
                           </div>
                        </div>
                    </div>
                }
                @if (dataService.posts().length === 0) {
                  <div class="text-center py-12 text-gray-400">
                    <p>还没有帖子，来发布第一条吧！</p>
                  </div>
                }
            </div>
          </div>
        }
      </div>
      
      <!-- Footer -->
      <div class="py-6 text-center text-gray-400 text-xs mt-8 border-t border-gray-200">
         <p>制作者联系方式 QQ：2433473591</p>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fade-in 0.3s ease-out;
    }
  `]
})
export class LobbyComponent {
  dataService = inject(DataService);
  isAdmin = this.dataService.isAdmin;
  unreadCount = this.dataService.totalUnreadCount;

  // Tabs
  activeTab = signal<'hall' | 'forum'>('hall');

  // Create Board Form
  createForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.minLength(2)]),
    isPrivate: new FormControl(false)
  });

  // Background Options
  selectedBg = signal('#ffffff');
  backgroundOptions = [
    { name: '纯白', value: '#ffffff' },
    { name: '护眼', value: '#faf7f0' }, // Warm/Paper
    { name: '淡蓝', value: '#f0f9ff' }, // Cool
    { name: '淡粉', value: '#fff1f2' }, // Pink
    { name: '薄荷', value: '#f0fdf4' }, // Mint
  ];

  joinCodeControl = new FormControl('');
  joinError = signal('');
  
  // Board Search
  boardSearch = '';
  
  filteredBoards = computed(() => {
      const all = this.dataService.publicBoards();
      const term = this.boardSearch.toLowerCase().trim();
      if (!term) return all;
      return all.filter(b => b.title.toLowerCase().includes(term) || b.creator.toLowerCase().includes(term));
  });

  // Forum State
  postTitle = '';
  postContent = '';

  onCreate() {
    if (this.createForm.valid) {
      const { title, isPrivate } = this.createForm.value;
      const bg = this.selectedBg();
      const id = this.dataService.createBoard(title!, isPrivate!, bg);
      this.dataService.joinBoard(id);
    }
  }

  onJoin() {
    const code = this.joinCodeControl.value?.trim().toUpperCase();
    if (code) {
      const success = this.dataService.joinBoard(code);
      if (!success) {
        this.joinError.set('未找到该 ID 的画板');
      } else {
        this.joinError.set('');
      }
    }
  }

  enterBoard(id: string) {
    this.dataService.joinBoard(id);
  }

  deleteBoard(id: string) {
      if(confirm('管理员操作：确定删除此画板吗？')) {
          this.dataService.deleteBoard(id);
      }
  }

  toggleBoardPin(id: string) {
      this.dataService.togglePinBoard(id);
  }

  goToUserCenter() {
    this.dataService.showUserCenter.set(true);
  }

  toggleChat() {
    this.dataService.showChat.update(v => !v);
  }

  // --- Forum Methods ---
  getAvatar(uid: string) {
      return this.dataService.getAvatar(uid);
  }
  
  getAdminTag(uid: string) {
      return this.dataService.getUserProfile(uid)?.adminTag;
  }

  createPost() {
      if (!this.postTitle.trim()) return;
      this.dataService.createPost(this.postTitle, this.postContent);
      this.postTitle = '';
      this.postContent = '';
  }

  deletePost(id: string) {
      if(confirm('管理员操作：确定删除此帖子？')) {
          this.dataService.deletePost(id);
      }
  }

  togglePin(id: string) {
      this.dataService.togglePinPost(id);
  }

  addComment(postId: string, content: string) {
      if (!content.trim()) return;
      this.dataService.addComment(postId, content);
  }
}