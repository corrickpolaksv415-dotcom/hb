import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-gray-50">
      <!-- Tabs -->
      <div class="flex p-2 bg-white border-b border-gray-200">
        <button 
          (click)="activeTab.set('all')"
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
          [class.bg-indigo-50]="activeTab() === 'all'"
          [class.text-indigo-700]="activeTab() === 'all'"
          [class.text-gray-500]="activeTab() !== 'all'">
          版本历史
        </button>
        <button 
          (click)="activeTab.set('mine')"
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
          [class.bg-indigo-50]="activeTab() === 'mine'"
          [class.text-indigo-700]="activeTab() === 'mine'"
          [class.text-gray-500]="activeTab() !== 'mine'">
          我的贡献
        </button>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-3">
        @if (!dataService.currentBoardId()) {
            <div class="text-center py-10 text-gray-400 text-sm">
                请先选择一个画板
            </div>
        } @else {

            @if (activeTab() === 'all') {
            <!-- List Feed -->
            <div class="space-y-4">
                @if (blessings().length === 0) {
                <div class="text-center py-10 text-gray-400">
                    <p>画板还是空的</p>
                    <p class="text-sm">保存第一个版本吧！</p>
                </div>
                }

                @for (item of blessings(); track item.id) {
                <div class="bg-white rounded-xl p-3 shadow-sm border border-gray-100 transition-all hover:shadow-md relative"
                     [class.ring-2]="isActiveVersion(item.id)"
                     [class.ring-indigo-500]="isActiveVersion(item.id)">
                    
                    @if (isActiveVersion(item.id)) {
                        <div class="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow z-10">
                            当前展示
                        </div>
                    }

                    <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-xs uppercase">
                        {{ item.author.slice(0, 2) }}
                        </div>
                        <div>
                        <span class="block text-sm font-semibold text-gray-800">{{ item.author }}</span>
                        <span class="block text-xs text-gray-400">{{ item.timestamp | date:'mediumTime' }}</span>
                        </div>
                    </div>
                    
                    <!-- Owner Action -->
                    @if (isOwner() && !isActiveVersion(item.id)) {
                        <button (click)="setAsActive(item.id)" class="text-xs bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 px-2 py-1 rounded transition-colors" title="设为当前展示版本">
                            设为展示
                        </button>
                    }
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                    <img [src]="item.imageData" class="w-full h-auto object-contain max-h-48" alt="Board Version">
                    </div>
                </div>
                }
            </div>
            } @else {
            <!-- Grid Gallery for History -->
            <div class="grid grid-cols-2 gap-3">
                @if (myBlessings().length === 0) {
                <div class="col-span-2 text-center py-10 text-gray-400">
                    <p>你还没有在这个画板发布过内容</p>
                </div>
                }
                
                @for (item of myBlessings(); track item.id) {
                <div class="group relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden aspect-square hover:shadow-md transition-all">
                    <img [src]="item.imageData" class="w-full h-full object-cover" alt="My drawing">
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span class="text-white text-xs font-medium truncate w-full">
                        {{ item.timestamp | date:'MM/dd HH:mm' }}
                    </span>
                    </div>
                </div>
                }
            </div>
            }

        }
      </div>
    </div>
  `
})
export class FeedComponent {
  dataService = inject(DataService);
  blessings = this.dataService.currentBoardBlessings;
  currentUser = this.dataService.currentUser;
  boardInfo = this.dataService.activeBoard;
  
  activeTab = signal<'all' | 'mine'>('all');

  myBlessings = computed(() => {
    const uid = this.currentUser();
    return this.blessings().filter(b => b.author === uid);
  });

  isOwner = computed(() => {
    return this.boardInfo()?.creator === this.currentUser();
  });

  isActiveVersion(itemId: string): boolean {
    const activeId = this.boardInfo()?.activeVersionId;
    if (activeId) {
        return activeId === itemId;
    }
    // If no active version is set explicitly, the latest one (index 0) is effectively active
    // But we only show the badge if explicitly set to avoid confusion, or maybe show on top?
    // Let's stick to: if explicit ID matches, OR if no ID and it's the first one.
    if (!activeId && this.blessings().length > 0) {
        return this.blessings()[0].id === itemId;
    }
    return false;
  }

  setAsActive(versionId: string) {
    const boardId = this.dataService.currentBoardId();
    if (boardId) {
        this.dataService.setBoardActiveVersion(boardId, versionId);
    }
  }
}