import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-user-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full bg-gray-50 flex flex-col p-4 md:p-8 overflow-y-auto">
      <div class="max-w-4xl mx-auto w-full">
        
        <!-- Header & Profile -->
        <div class="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div class="flex items-center gap-4 w-full md:w-auto">
             <button (click)="goBack()" class="p-2 rounded-full hover:bg-gray-200 transition-colors">
                <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
             </button>
             
             <!-- Avatar Upload -->
             <div class="relative group cursor-pointer">
                <div class="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md bg-white">
                   @if (myAvatar()) {
                      <img [src]="myAvatar()" class="w-full h-full object-cover">
                   } @else {
                      <div class="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-300 font-bold text-3xl">
                        {{ dataService.currentUser()?.slice(0,1) }}
                      </div>
                   }
                </div>
                <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <input type="file" (change)="onFileSelected($event)" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
             </div>

             <div>
                <div class="flex items-center gap-2">
                   <h1 class="text-2xl font-bold text-gray-900">{{ dataService.currentUser() }}</h1>
                   @if (myProfile()?.adminTag; as tag) {
                       <span class="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-200 font-bold">{{ tag }}</span>
                   }
                </div>
                
                <!-- Social Stats -->
                <div class="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <div class="flex items-center gap-1">
                        <span class="font-bold text-gray-900">{{ followersCount() }}</span> 粉丝
                    </div>
                    <div class="w-px h-3 bg-gray-300"></div>
                    <div class="flex items-center gap-1">
                        <span class="font-bold text-gray-900">{{ followingCount() }}</span> 关注
                    </div>
                    <div class="w-px h-3 bg-gray-300"></div>
                    <div class="flex items-center gap-1">
                        <span class="font-bold text-gray-900">{{ likesReceivedCount() }}</span> 获赞
                    </div>
                </div>
             </div>
          </div>
        </div>

        <!-- Content: Boards (No Tabs needed anymore as it's the only content) -->
        
        <h2 class="text-lg font-bold mb-4 text-gray-700">我的画板</h2>

        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div class="text-gray-500 text-sm font-medium mb-1">我创建的画板</div>
                <div class="text-3xl font-bold text-gray-900">{{ dataService.myBoards().length }}</div>
            </div>
        </div>

        <!-- Boards List -->
        @if (dataService.myBoards().length === 0) {
            <div class="bg-white rounded-xl p-10 text-center border border-dashed border-gray-300">
                <p class="text-gray-400 mb-4">你还没有创建任何画板</p>
                <button (click)="goBack()" class="text-indigo-600 font-medium hover:underline">去大厅创建一个</button>
            </div>
        } @else {
            <div class="space-y-4">
                @for (board of dataService.myBoards(); track board.id) {
                    <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-indigo-200">
                        <div (click)="enterBoard(board.id)" class="cursor-pointer group">
                            <h3 class="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">{{ board.title }}</h3>
                            <div class="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                <span class="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">ID: {{ board.id }}</span>
                                <span>{{ board.createdAt | date:'mediumDate' }}</span>
                                @if (board.isPrivate) {
                                    <span class="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                        私有
                                    </span>
                                } @else {
                                    <span class="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">公开</span>
                                }
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button (click)="enterBoard(board.id)" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium text-sm hover:bg-indigo-100 transition-colors">
                                进入画板
                            </button>
                            <button (click)="deleteBoard(board.id)" class="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium text-sm hover:bg-red-100 transition-colors border border-red-100">
                                删除
                            </button>
                        </div>
                    </div>
                }
            </div>
        }
      </div>
    </div>
  `
})
export class UserCenterComponent {
  dataService = inject(DataService);
  myProfile = this.dataService.currentUserProfile;
  myAvatar = computed(() => this.myProfile()?.avatar);
  
  followersCount = computed(() => {
      const uid = this.dataService.currentUser();
      return uid ? this.dataService.getFollowerCount(uid) : 0;
  });

  followingCount = computed(() => {
      const uid = this.dataService.currentUser();
      return uid ? this.dataService.getFollowingCount(uid) : 0;
  });

  likesReceivedCount = computed(() => {
      const uid = this.dataService.currentUser();
      return uid ? this.dataService.getLikeCount(uid) : 0;
  });

  goBack() {
    this.dataService.showUserCenter.set(false);
  }

  enterBoard(id: string) {
    this.dataService.joinBoard(id);
  }

  deleteBoard(id: string) {
    if (confirm('确定要删除这个画板吗？所有历史记录都将丢失，且无法恢复。')) {
        this.dataService.deleteBoard(id);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        this.dataService.updateProfile(this.dataService.currentUser()!, base64);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }
}