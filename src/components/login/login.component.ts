import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { ReactiveFormsModule, FormControl, Validators, FormGroup, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all hover:scale-[1.01]">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-800 mb-2">期末祝福画板</h1>
          <p class="text-gray-500">登录以分享你的好运与祝福</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">用户 ID / 账号</label>
            <input 
              formControlName="uid"
              type="text" 
              class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
              placeholder="请输入你的账号（新账号自动注册）"
            />
            @if (loginForm.get('uid')?.invalid && loginForm.get('uid')?.touched) {
              <p class="text-red-500 text-xs mt-1">账号至少需要2个字符</p>
            }
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
            <input 
              formControlName="password"
              type="password" 
              class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
              placeholder="设置或输入密码"
            />
             @if (loginForm.get('password')?.invalid && loginForm.get('password')?.touched) {
              <p class="text-red-500 text-xs mt-1">密码至少需要4个字符</p>
            }
          </div>

          <!-- Admin Registration Toggle -->
          <div class="flex items-center gap-2">
             <input type="checkbox" id="adminToggle" [(ngModel)]="isRegisteringAdmin" [ngModelOptions]="{standalone: true}" class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-gray-300">
             <label for="adminToggle" class="text-sm text-gray-600 select-none cursor-pointer">注册为管理员</label>
          </div>

          <!-- Admin Fields -->
          @if (isRegisteringAdmin) {
             <div class="bg-purple-50 p-4 rounded-lg border border-purple-100 space-y-4 animate-fade-in">
                <div>
                   <label class="block text-xs font-bold text-purple-800 mb-1">管理员密钥</label>
                   <input type="password" [(ngModel)]="adminKey" [ngModelOptions]="{standalone: true}" class="w-full px-3 py-2 text-sm border rounded outline-none focus:border-purple-500" placeholder="请输入管理员密钥">
                </div>
                <div>
                   <label class="block text-xs font-bold text-purple-800 mb-1">自定义标签 (选填)</label>
                   <input type="text" [(ngModel)]="adminTag" [ngModelOptions]="{standalone: true}" class="w-full px-3 py-2 text-sm border rounded outline-none focus:border-purple-500" placeholder="默认: <管理员>">
                </div>
             </div>
          }
          
          @if (errorMsg()) {
            <div class="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {{ errorMsg() }}
            </div>
          }

          <button 
            type="submit"
            [disabled]="loginForm.invalid"
            class="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 px-6 rounded-lg shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
            进入画板
          </button>
        </form>
        
        <div class="mt-6 text-center">
          <p class="text-xs text-gray-400">UID 与密码绑定，可用于找回历史记录</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="absolute bottom-4 text-center text-white/80 text-xs">
         <p>制作者联系方式 QQ：2433473591</p>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fade-in {
       from { opacity: 0; transform: translateY(-5px); }
       to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
       animation: fade-in 0.3s ease-out;
    }
  `]
})
export class LoginComponent {
  dataService = inject(DataService);
  
  loginForm = new FormGroup({
    uid: new FormControl('', [Validators.required, Validators.minLength(2)]),
    password: new FormControl('', [Validators.required, Validators.minLength(4)])
  });

  isRegisteringAdmin = false;
  adminKey = '';
  adminTag = '';
  private readonly SECRET_KEY = 'wyxrl_小樾';

  errorMsg = signal('');

  onLogin() {
    if (this.loginForm.valid) {
      const { uid, password } = this.loginForm.value;
      
      // Admin Logic check
      if (this.isRegisteringAdmin && this.adminKey !== this.SECRET_KEY) {
          this.errorMsg.set('管理员密钥错误');
          return;
      }

      const success = this.dataService.authenticate(
          uid!, 
          password!, 
          this.isRegisteringAdmin, 
          this.isRegisteringAdmin ? this.adminTag : ''
      );
      
      if (!success) {
        this.errorMsg.set('密码错误，请重试');
      } else {
        this.errorMsg.set('');
      }
    }
  }
}