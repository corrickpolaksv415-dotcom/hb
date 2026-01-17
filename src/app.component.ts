import { Component, inject } from '@angular/core';
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
    <div class="h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      @if (!isLoggedIn()) {
        <app-login />
      } @else {
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
  
  constructor() {
    // Ensuring heartbeats start if token exists implicitly via service
  }

  logout() {
    this.dataService.logout();
  }
}