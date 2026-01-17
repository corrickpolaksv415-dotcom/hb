import { Component, inject, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, ChatMessage } from '../../services/data.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Chat Window - Positioned Top Right -->
    @if (isOpen()) {
      <div class="fixed top-16 right-4 z-50 w-80 md:w-96 h-[600px] max-h-[calc(100vh-5rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in-down transition-all">
        
        <!-- Header -->
        <div class="bg-indigo-600 p-3 flex justify-between items-center text-white flex-none shadow-md z-10">
          <div class="flex items-center gap-2">
             @if (currentView() === 'room') {
               <button (click)="currentView.set('list')" class="hover:bg-indigo-700 p-1 rounded">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
               </button>
               <span class="font-bold truncate max-w-[120px]">{{ chatTitle() }}</span>
             } @else {
               <span class="font-bold">消息中心</span>
             }
          </div>
          
          <div class="flex items-center gap-1">
              <!-- Background Settings Button -->
              <button (click)="showBgSettings.set(!showBgSettings())" class="hover:bg-indigo-700 p-1.5 rounded relative" title="聊天背景">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </button>
              
              <button (click)="close()" class="hover:bg-indigo-700 p-1 rounded">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
          </div>
        </div>

        <!-- Background Settings Panel -->
        @if (showBgSettings()) {
            <div class="bg-gray-100 p-2 border-b border-gray-200 flex gap-2 overflow-x-auto flex-none">
                <button (click)="setBackground('')" class="w-8 h-8 rounded-full border border-gray-300 bg-white" title="默认"></button>
                <button (click)="setBackground('#f3f4f6')" class="w-8 h-8 rounded-full border border-gray-300 bg-gray-100" title="灰色"></button>
                <button (click)="setBackground('#eff6ff')" class="w-8 h-8 rounded-full border border-blue-200 bg-blue-50" title="淡蓝"></button>
                <button (click)="setBackground('#fdf2f8')" class="w-8 h-8 rounded-full border border-pink-200 bg-pink-50" title="淡粉"></button>
                <div class="relative w-8 h-8 rounded-full border border-gray-300 overflow-hidden flex items-center justify-center bg-indigo-50">
                    <span class="text-[8px] text-gray-500">图片</span>
                    <input type="file" (change)="onBgImageSelected($event)" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                </div>
            </div>
        }

        <!-- Body -->
        <div class="flex-1 overflow-hidden flex flex-col bg-gray-50 relative">
          
          <!-- Custom Background Layer for Room -->
          @if (currentView() === 'room' && chatBackground()) {
             <div class="absolute inset-0 z-0 bg-cover bg-center opacity-50 pointer-events-none" 
                 [style.backgroundImage]="isImageBg() ? 'url(' + chatBackground() + ')' : 'none'"
                 [style.backgroundColor]="!isImageBg() ? chatBackground() : 'transparent'">
             </div>
          }

          <!-- VIEW: List (Contacts & Groups) -->
          @if (currentView() === 'list') {
            <div class="flex-1 overflow-y-auto p-2 space-y-4 relative z-10">
              
              <!-- Create Group Section -->
              <div class="bg-white p-3 rounded-lg shadow-sm">
                 <div class="flex gap-2">
                   <input type="text" [(ngModel)]="newGroupName" placeholder="新建群组名称" class="flex-1 text-sm border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500">
                   <button (click)="createGroup()" [disabled]="!newGroupName" class="bg-indigo-100 text-indigo-700 text-xs px-2 rounded font-medium disabled:opacity-50">新建</button>
                 </div>
              </div>

              <!-- Groups List -->
              <div>
                 <h3 class="text-xs font-bold text-gray-400 uppercase mb-2 px-1">群聊</h3>
                 @if (myGroups().length === 0) {
                   <p class="text-xs text-gray-400 px-2 italic">暂无加入的群组</p>
                 }
                 @for (group of myGroups(); track group.id) {
                   <div (click)="enterGroup(group.id, group.name)" class="flex items-center gap-3 p-2 bg-white rounded-lg hover:bg-gray-100 cursor-pointer transition-colors mb-1 relative">
                      <div class="w-8 h-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">群</div>
                      <div class="flex-1 truncate">
                         <span class="text-sm font-medium text-gray-800">{{ group.name }}</span>
                      </div>
                      <!-- Unread Badge -->
                      @let count = getUnreadCount(undefined, group.id);
                      @if (count > 0) {
                          <span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{{ count > 99 ? '99+' : count }}</span>
                      }
                   </div>
                 }
                 
                 <!-- Join other groups -->
                 @if (otherGroups().length > 0) {
                     <h4 class="text-[10px] font-bold text-gray-400 uppercase mt-2 mb-1 px-1">可加入</h4>
                     @for (group of otherGroups(); track group.id) {
                       <div class="flex items-center justify-between p-2 bg-gray-100 rounded-lg mb-1">
                          <span class="text-xs font-medium text-gray-600">{{ group.name }}</span>
                          <button (click)="joinGroup(group.id)" class="text-[10px] bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">加入</button>
                       </div>
                     }
                 }
              </div>

              <!-- Users List -->
              <div>
                 <div class="flex justify-between items-center mb-2 px-1">
                    <h3 class="text-xs font-bold text-gray-400 uppercase">用户私聊</h3>
                 </div>
                 <div class="mb-2 px-1">
                    <input [(ngModel)]="userSearch" placeholder="搜索用户(字典序)..." class="w-full text-xs px-2 py-1 border rounded bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none">
                 </div>

                 @for (uid of otherUsers(); track uid) {
                   <div (click)="enterDirectChat(uid)" class="flex items-center gap-3 p-2 bg-white rounded-lg hover:bg-gray-100 cursor-pointer transition-colors mb-1">
                      <!-- Avatar & Status -->
                      <div class="relative w-8 h-8 flex-shrink-0">
                         <div class="w-full h-full rounded-full overflow-hidden bg-gray-200 border border-gray-100">
                            @if (getAvatar(uid)) {
                                <img [src]="getAvatar(uid)" class="w-full h-full object-cover">
                            } @else {
                                <div class="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">{{ uid.slice(0,1) }}</div>
                            }
                         </div>
                         <!-- Online Status Dot -->
                         <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                              [class.bg-green-500]="isOnline(uid)" 
                              [class.bg-gray-400]="!isOnline(uid)"
                              title="{{ isOnline(uid) ? '在线' : '离线' }}">
                         </div>
                      </div>

                      <div class="flex-1 truncate">
                         <span class="text-sm font-medium text-gray-800">{{ uid }}</span>
                      </div>
                      
                      <!-- Unread Badge -->
                      @let count = getUnreadCount(uid);
                      @if (count > 0) {
                          <span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{{ count > 99 ? '99+' : count }}</span>
                      }
                   </div>
                 }
              </div>
            </div>
          }

          <!-- VIEW: Room (Messages) -->
          @if (currentView() === 'room') {
            <div class="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth relative z-10" #scrollContainer>
               @for (msg of activeMessages(); track msg.id) {
                  <div class="flex flex-col" [class.items-end]="msg.sender === currentUser()" [class.items-start]="msg.sender !== currentUser()">
                     <div class="flex items-end gap-1 max-w-[85%] group">
                        @if (msg.sender !== currentUser()) {
                           <div class="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 text-[10px] flex items-center justify-center cursor-pointer" title="{{msg.sender}}">
                              @if (getAvatar(msg.sender)) { <img [src]="getAvatar(msg.sender)" class="w-full h-full object-cover"> } @else { {{msg.sender.slice(0,1)}} }
                           </div>
                        }

                        <!-- Message Bubble -->
                        @if (msg.isRecalled) {
                            <div class="px-3 py-1 bg-gray-200 text-gray-500 text-xs rounded italic">
                                消息已撤回
                            </div>
                        } @else {
                            <div class="flex flex-col">
                                <!-- Image Content -->
                                @if (msg.type === 'image') {
                                    <div class="rounded-lg overflow-hidden border border-gray-200 mb-1">
                                        <img [src]="msg.content" class="max-w-full max-h-48 object-contain">
                                    </div>
                                } @else {
                                    <!-- Text Content -->
                                    <div class="px-3 py-2 rounded-2xl text-sm break-words shadow-sm"
                                        [class.bg-indigo-600]="msg.sender === currentUser()"
                                        [class.text-white]="msg.sender === currentUser()"
                                        [class.bg-white]="msg.sender !== currentUser()"
                                        [class.text-gray-800]="msg.sender !== currentUser()"
                                        [class.rounded-br-none]="msg.sender === currentUser()"
                                        [class.rounded-bl-none]="msg.sender !== currentUser()">
                                    <!-- Show sender name in group chat -->
                                    @if (activeGroupId() && msg.sender !== currentUser()) {
                                        <div class="text-[10px] opacity-70 mb-0.5">{{ msg.sender }}</div>
                                    }
                                    {{ msg.content }}
                                    </div>
                                }
                                
                                <!-- Recall Button (Visible on hover for own messages < 2 mins) -->
                                @if (msg.sender === currentUser() && canRecall(msg.timestamp)) {
                                    <div class="text-[10px] text-gray-400 text-right opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-red-500 hover:underline mt-0.5" (click)="recall(msg.id)">
                                        撤回
                                    </div>
                                }
                            </div>
                        }
                     </div>
                     <span class="text-[10px] text-gray-400 mt-1 px-1 select-none">{{ msg.timestamp | date:'shortTime' }}</span>
                  </div>
               }
            </div>

            <!-- Input -->
            <div class="p-3 bg-white border-t border-gray-200 flex gap-2 flex-none z-20">
               <div class="flex items-center gap-1">
                  <!-- Image Upload -->
                  <div class="relative w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer text-gray-500 hover:text-indigo-600 transition-colors">
                     <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                     <input type="file" (change)="onSendImage($event)" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" title="发送图片">
                  </div>
               </div>
               
               <input 
                 #msgInput
                 type="text" 
                 [(ngModel)]="newMessage" 
                 (keydown.enter)="sendMessage()"
                 placeholder="输入消息..." 
                 class="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
               
               <button (click)="sendMessage()" [disabled]="!newMessage.trim()" class="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full transition-colors disabled:opacity-50">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
               </button>
            </div>
          }

        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fade-in-down {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-down {
      animation: fade-in-down 0.2s ease-out;
    }
  `]
})
export class ChatComponent {
  dataService = inject(DataService);
  currentUser = this.dataService.currentUser;
  isOpen = this.dataService.showChat;

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  // View State
  currentView = signal<'list' | 'room'>('list');
  activeContactId = signal<string | null>(null);
  activeGroupId = signal<string | null>(null);
  showBgSettings = signal(false);

  // Input
  newMessage = '';
  newGroupName = '';
  userSearch = '';

  // Background
  chatBackground = computed(() => {
      const profile = this.dataService.currentUserProfile();
      return profile?.chatBackground || '';
  });

  isImageBg() {
      const bg = this.chatBackground();
      return bg.startsWith('data:image') || bg.startsWith('http');
  }

  // Lists
  otherUsers = computed(() => {
    const term = this.userSearch.toLowerCase().trim();
    const users = this.dataService.getAllUsers().filter(u => u !== this.currentUser());
    users.sort((a, b) => a.localeCompare(b, 'zh-CN'));
    if (!term) return users;
    return users.filter(u => u.toLowerCase().includes(term));
  });

  myGroups = computed(() => this.dataService.getMyGroups());
  
  otherGroups = computed(() => {
      const myIds = this.myGroups().map(g => g.id);
      return this.dataService.getAllPublicGroups().filter(g => !myIds.includes(g.id));
  });

  // Messages
  activeMessages = computed(() => {
    if (this.activeGroupId()) {
      return this.dataService.getMessagesFor(undefined, this.activeGroupId()!);
    }
    if (this.activeContactId()) {
      return this.dataService.getMessagesFor(this.activeContactId()!, undefined);
    }
    return [];
  });

  chatTitle = computed(() => {
    if (this.activeGroupId()) {
      return this.myGroups().find(g => g.id === this.activeGroupId())?.name || '群聊';
    }
    return this.activeContactId() || '聊天';
  });

  constructor() {
    // Auto scroll & Mark read
    effect(() => {
      const msgs = this.activeMessages();
      const view = this.currentView();
      
      if (view === 'room') {
          // Scroll
          if (msgs.length >= 0) {
            setTimeout(() => {
                if (this.scrollContainer) {
                    this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
                }
            }, 50);
          }
          
          // Mark Read
          setTimeout(() => {
             this.dataService.markMessagesAsRead(this.activeContactId() || undefined, this.activeGroupId() || undefined);
          }, 500);
      }
    });
  }

  close() {
    this.isOpen.set(false);
  }

  getAvatar(uid: string) {
    return this.dataService.getAvatar(uid);
  }

  isOnline(uid: string) {
      return this.dataService.isUserOnline(uid);
  }

  getUnreadCount(uid?: string, groupId?: string) {
      return this.dataService.getUnreadCountFor(uid, groupId);
  }

  enterDirectChat(uid: string) {
    this.activeContactId.set(uid);
    this.activeGroupId.set(null);
    this.currentView.set('room');
    this.showBgSettings.set(false);
  }

  enterGroup(groupId: string, name: string) {
    this.activeGroupId.set(groupId);
    this.activeContactId.set(null);
    this.currentView.set('room');
    this.showBgSettings.set(false);
  }

  createGroup() {
    if (this.newGroupName) {
      const id = this.dataService.createGroup(this.newGroupName);
      this.newGroupName = '';
      this.enterGroup(id, this.newGroupName);
    }
  }
  
  joinGroup(id: string) {
      this.dataService.joinGroup(id);
  }

  // Message Actions

  sendMessage() {
    if (!this.newMessage.trim()) return;
    
    if (this.activeGroupId()) {
      this.dataService.sendMessage(this.newMessage, undefined, this.activeGroupId()!, 'text');
    } else if (this.activeContactId()) {
      this.dataService.sendMessage(this.newMessage, this.activeContactId()!, undefined, 'text');
    }
    this.newMessage = '';
  }

  onSendImage(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const base64 = e.target?.result as string;
              if (this.activeGroupId()) {
                  this.dataService.sendMessage(base64, undefined, this.activeGroupId()!, 'image');
              } else if (this.activeContactId()) {
                  this.dataService.sendMessage(base64, this.activeContactId()!, undefined, 'image');
              }
          };
          reader.readAsDataURL(input.files[0]);
      }
      input.value = '';
  }

  canRecall(timestamp: number): boolean {
      // 2 minutes limit
      return (Date.now() - timestamp) < 120000;
  }

  recall(msgId: string) {
      if (confirm('确定要撤回这条消息吗？')) {
          this.dataService.recallMessage(msgId);
      }
  }

  // Background Settings
  setBackground(bg: string) {
      this.dataService.updateChatBackground(bg);
  }

  onBgImageSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const base64 = e.target?.result as string;
              this.setBackground(base64);
          };
          reader.readAsDataURL(input.files[0]);
      }
  }
}