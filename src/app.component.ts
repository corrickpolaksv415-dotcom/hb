import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './components/login/login.component';
import { BoardComponent } from './components/board/board.component';
import { FeedComponent } from './components/feed/feed.component';
import { LobbyComponent } from './components/lobby/lobby.component';
import { UserCenterComponent } from './components/user-center/user-center.component';
import { ChatComponent } from './components/chat/chat.component';
import { DataService } from './services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent, BoardComponent, FeedComponent, LobbyComponent, UserCenterComponent, ChatComponent],
  template: `
    <div class="h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans relative">
      @if (!isLoggedIn()) {
        <app-login />
      } @else {
        
        <!-- Announcement Modal -->
        @if (showAnnouncement() && dataService.announcement()) {
            <div class="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center gap-3">
                         <svg class="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                         <h2 class="text-xl font-bold">公告</h2>
                    </div>
                    <div class="p-6">
                        <p class="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">{{ dataService.announcement() }}</p>
                    </div>
                    <div class="p-4 bg-gray-50 flex justify-end">
                        <button (click)="closeAnnouncement()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all shadow-lg hover:shadow-indigo-200">
                            我知道了
                        </button>
                    </div>
                </div>
            </div>
        }

        @if (showUserCenter()) {
          <app-user-center />
        } @else {
          @if (!currentBoardId()) {
            <app-lobby />
          } @else {
             <div class="flex h-full w-full">
                <div class="flex-1 h-full relative min-w-0">
                   <app-board />
                </div>
                <div class="w-80 md:w-96 border-l border-gray-200 bg-white flex-none h-full shadow-xl z-20 hidden md:block">
                   <app-feed />
                </div>
             </div>
          }
        }
        
        <!-- Global Chat Widget -->
        <app-chat />
      }
    </div>
  `
})
export class AppComponent {
  dataService = inject(DataService);
  isLoggedIn = this.dataService.currentUser;
  currentBoardId = this.dataService.currentBoardId;
  showUserCenter = this.dataService.showUserCenter;
  
  showAnnouncement = signal(false);

  constructor() {
     effect(() => {
         if (this.isLoggedIn() && this.dataService.announcement()) {
             // Simple session check: if not acknowledged in this session, show it.
             const hasRead = sessionStorage.getItem('announcement_read_v1');
             if (!hasRead) {
                 this.showAnnouncement.set(true);
             }
         }
     });
  }

  closeAnnouncement() {
      this.showAnnouncement.set(false);
      sessionStorage.setItem('announcement_read_v1', 'true');
  }

  logout() {
    this.dataService.logout();
  }
}