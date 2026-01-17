import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, signal, effect, Injector, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, CanvasElement } from '../../services/data.service';
import { AiService } from '../../services/ai.service';

type Tool = 'select' | 'pen' | 'text'; 
type FontStyle = 'font-sans' | 'font-calligraphy' | 'font-round';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: { class: 'block w-full h-full' },
  template: `
    <div class="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative select-none w-full">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-4 py-2 bg-gray-900 text-white flex-none">
        <div class="flex items-center gap-3">
          <button (click)="dataService.leaveBoard()" class="hover:bg-gray-700 p-1.5 rounded-full transition-colors" title="返回大厅">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div class="hidden md:block">
            <h2 class="text-sm font-bold">{{ boardInfo()?.title }}</h2>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
           @if (isOwner()) {
               <button (click)="toggleShowAuthors()" [class.bg-indigo-600]="showAuthors()" [class.bg-gray-700]="!showAuthors()" class="text-xs px-2 py-1.5 rounded transition-colors" title="显示修改者">
                  显示作者
               </button>
               <div class="h-4 w-px bg-gray-600"></div>
           }
           <button (click)="openDownloadModal()" class="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded-full transition-colors" title="下载画板">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
           </button>
           <button (click)="toggleChat()" class="bg-indigo-600 hover:bg-indigo-500 p-1.5 rounded-full transition-colors" title="聊天">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
           </button>
           <div class="h-4 w-px bg-gray-600"></div>
           <button (click)="saveBlessing()" class="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors flex items-center gap-1">
            <span>保存版本</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </button>
        </div>
      </div>
      
      @if (showDownloadModal()) {
        <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div class="bg-white rounded-xl shadow-2xl p-6 w-80">
                <h3 class="text-lg font-bold text-gray-800 mb-4">下载图片</h3>
                <div class="space-y-3 mb-6">
                    <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                        <input type="checkbox" [ngModel]="includeUrl()" (ngModelChange)="includeUrl.set($event)" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500">
                        <span class="text-sm text-gray-700">添加网址水印</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                        <input type="checkbox" [ngModel]="includeName()" (ngModelChange)="includeName.set($event)" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500">
                        <span class="text-sm text-gray-700">添加画板名称 & 作者</span>
                    </label>
                </div>
                <div class="flex gap-3">
                    <button (click)="showDownloadModal.set(false)" class="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">取消</button>
                    <button (click)="confirmDownload()" class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">下载</button>
                </div>
            </div>
        </div>
      }

      <div class="flex items-center gap-2 p-2 border-b border-gray-200 bg-gray-50 flex-none overflow-x-auto relative min-h-[52px]">
        @if (!selectedElement()) {
          <div class="flex items-center gap-2 w-full">
            <div class="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
               <button (click)="setTool('select')" [class.bg-indigo-50]="tool() === 'select'" [class.text-indigo-600]="tool() === 'select'" class="p-2 rounded hover:bg-gray-50" title="选择/移动">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
              </button>
              <button (click)="setTool('pen')" [class.bg-indigo-50]="tool() === 'pen'" [class.text-indigo-600]="tool() === 'pen'" class="p-2 rounded hover:bg-gray-50" title="画笔">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </button>
              <button (click)="setTool('text')" [class.bg-indigo-50]="tool() === 'text'" [class.text-indigo-600]="tool() === 'text'" class="p-2 rounded hover:bg-gray-50" title="添加文字">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </button>
              <label class="p-2 rounded hover:bg-gray-50 cursor-pointer text-gray-600" title="插入图片">
                <input type="file" (change)="uploadImage($event)" accept="image/*" class="hidden">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </label>
              <div class="h-6 w-px bg-gray-300 mx-1"></div>
              <button (click)="getAiInspiration()" [disabled]="isGenerating()" class="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs px-2 py-2 rounded transition-all disabled:opacity-50">
                @if (isGenerating()) { <span class="animate-spin">⌛</span> } @else { <span class="text-sm">✨</span> }
                <span class="hidden sm:inline">AI 灵感</span>
              </button>
            </div>
            <div class="h-6 w-px bg-gray-300"></div>
            <div class="flex gap-1 items-center">
              @for (color of colors; track color) {
                <button [style.backgroundColor]="color" class="w-5 h-5 rounded-full border border-gray-200 transition-transform hover:scale-110" [class.ring-2]="selectedColor() === color" [class.ring-gray-400]="selectedColor() === color" (click)="selectedColor.set(color)"></button>
              }
              <div class="relative w-5 h-5 rounded-full border border-gray-200 overflow-hidden transition-transform hover:scale-110 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 shadow-sm" [class.ring-2]="!colors.includes(selectedColor())" [class.ring-gray-400]="!colors.includes(selectedColor())">
                <input type="color" [value]="selectedColor()" (input)="onColorPick($event)" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
              </div>
            </div>
            @if (tool() === 'text') {
              <div class="h-6 w-px bg-gray-300"></div>
              <div class="flex items-center gap-2">
                  <select [ngModel]="selectedFont()" (ngModelChange)="selectedFont.set($event)" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                    <option value="font-sans">黑体</option>
                    <option value="font-calligraphy">书法</option>
                    <option value="font-round">幼圆</option>
                  </select>
                  <select [ngModel]="selectedFontSize()" (ngModelChange)="selectedFontSize.set(+$event)" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                     @for (size of fontSizes; track size) { <option [value]="size">{{ size }}px</option> }
                  </select>
              </div>
            }
            <div class="flex-1"></div>
            <button (click)="clearCanvas()" class="text-xs text-red-500 hover:text-red-700 px-2">清空画板</button>
          </div>
        } @else {
          <div class="flex items-center gap-3 w-full animate-fade-in overflow-x-auto">
            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase whitespace-nowrap">{{ selectedElement()?.type === 'image' ? '图片' : '文字' }}</span>
            <div class="h-6 w-px bg-gray-300"></div>
            @if (selectedElement()?.type === 'text') {
               <div class="flex items-center gap-2">
                  <select [ngModel]="selectedFont()" (ngModelChange)="updateSelectedText({fontStyleKey: $event})" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white max-w-[80px]">
                    <option value="font-sans">黑体</option>
                    <option value="font-calligraphy">书法</option>
                    <option value="font-round">幼圆</option>
                  </select>
                  <select [ngModel]="selectedFontSize()" (ngModelChange)="updateSelectedText({fontSize: +$event})" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                     @for (size of fontSizes; track size) { <option [value]="size">{{ size }}px</option> }
                  </select>
                  <div class="relative w-5 h-5 rounded border border-gray-300 overflow-hidden cursor-pointer" [style.backgroundColor]="selectedColor()">
                     <input type="color" [value]="selectedColor()" (input)="updateSelectedText({color: $any($event.target).value})" class="absolute inset-0 opacity-0 w-full h-full">
                  </div>
                  <div class="h-4 w-px bg-gray-200"></div>
                  <div class="flex items-center gap-1 bg-gray-100 p-1 rounded">
                     <span class="text-[10px] text-gray-500 font-bold px-1">描边</span>
                     <div class="relative w-5 h-5 rounded border border-gray-300 overflow-hidden cursor-pointer bg-white">
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none" *ngIf="!selectedStrokeColor() || selectedStrokeColor() === 'transparent'">
                           <div class="w-full h-px bg-red-500 rotate-45"></div>
                        </div>
                        <div *ngIf="selectedStrokeColor() && selectedStrokeColor() !== 'transparent'" class="w-full h-full" [style.backgroundColor]="selectedStrokeColor()"></div>
                        <input type="color" [value]="selectedStrokeColor() || '#000000'" (input)="updateSelectedText({strokeColor: $any($event.target).value})" class="absolute inset-0 opacity-0 w-full h-full">
                     </div>
                     <input type="number" [ngModel]="selectedStrokeWidth()" (ngModelChange)="updateSelectedText({strokeWidth: $event})" min="0" max="10" class="w-10 text-xs border border-gray-300 rounded px-1 py-0.5 outline-none text-center">
                  </div>
               </div>
               <div class="h-6 w-px bg-gray-300"></div>
            }
            <div class="flex items-center gap-1">
              <button (click)="moveLayer('up')" class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg></button>
              <button (click)="moveLayer('down')" class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button>
            </div>
            <div class="h-6 w-px bg-gray-300"></div>
            <button (click)="deleteSelected()" class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>删除</button>
            <div class="flex-1"></div>
            <button (click)="deselect()" class="text-xs text-gray-500 hover:text-gray-800 px-2 whitespace-nowrap">完成</button>
          </div>
        }
      </div>
      <div class="relative flex-1 bg-white cursor-crosshair touch-none overflow-hidden group w-full">
        <canvas #canvas (mousedown)="startAction($event)" (mousemove)="moveAction($event)" (mouseup)="endAction()" (mouseleave)="endAction()" (touchstart)="startAction($event)" (touchmove)="moveAction($event)" (touchend)="endAction()" class="block w-full h-full"></canvas>
        @if (creatingTextPos) {
          <input #textInput type="text" [style.top.px]="creatingTextPos.y" [style.left.px]="creatingTextPos.x" [style.color]="selectedColor()" [style.font-size.px]="selectedFontSize()" [class]="selectedFont() + ' absolute bg-transparent border-b border-dashed border-gray-400 outline-none p-0 z-50'" (blur)="commitText()" (keydown.enter)="textInput.blur()" placeholder="输入..." autofocus />
        }
      </div>
    </div>
  `
})
export class BoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('textInput') textInputRef!: ElementRef<HTMLInputElement>;
  dataService = inject(DataService);
  aiService = inject(AiService);
  injector = inject(Injector);
  boardInfo = this.dataService.activeBoard;
  currentUser = this.dataService.currentUser;
  
  tool = signal<Tool>('pen');
  colors = ['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  selectedColor = signal('#000000');
  fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
  selectedFont = signal<FontStyle>('font-sans');
  selectedFontSize = signal(24);
  selectedStrokeColor = signal<string>('');
  selectedStrokeWidth = signal(2);
  isGenerating = signal(false);
  showDownloadModal = signal(false);
  includeUrl = signal(true);
  includeName = signal(true);
  showAuthors = signal(false);
  
  private ctx!: CanvasRenderingContext2D; 
  private backgroundCanvas!: HTMLCanvasElement;
  private backgroundCtx!: CanvasRenderingContext2D;
  private resizeObserver!: ResizeObserver;

  // Synced Elements from DataService
  elements = this.dataService.currentBoardElements;
  selectedElement = signal<CanvasElement | null>(null);

  private isDrawing = false;
  private isDragging = false;
  private isResizing = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialElX = 0;
  private initialElY = 0;
  private initialElW = 0;
  private initialElH = 0;
  creatingTextPos: {x: number, y: number} | null = null;
  private readonly fontMap: Record<string, string> = { 'font-sans': 'Noto Sans SC', 'font-calligraphy': 'Ma Shan Zheng', 'font-round': 'ZCOOL KuaiLe' };
  isOwner = computed(() => this.boardInfo()?.creator === this.currentUser());

  ngAfterViewInit() {
    this.initCanvas();
    this.resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => this.resizeCanvas()));
    if (this.canvasRef.nativeElement.parentElement) this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement);
    
    // Listen to Element Changes from Realtime
    effect(() => {
        const els = this.elements();
        // Preload images if any
        els.forEach(el => {
            if (el.type === 'image' && el.imageSrc && !el.image) {
                const img = new Image();
                img.onload = () => { el.image = img; this.render(); };
                img.src = el.imageSrc;
            }
        });
        // Render whenever elements update
        this.render();
    }, { injector: this.injector });

    // Handle Active Version (Background)
    effect(() => {
        const blessings = this.dataService.currentBoardBlessings();
        const activeBoard = this.dataService.activeBoard();
        if (blessings.length > 0) {
            let targetItem = blessings[0]; 
            if (activeBoard?.activeVersionId) {
                const found = blessings.find(b => b.id === activeBoard.activeVersionId);
                if (found) targetItem = found;
            }
            setTimeout(() => this.loadBackground(targetItem.imageData), 100);
        } else {
             this.clearCanvas(false);
        }
    }, { injector: this.injector });
  }

  ngOnDestroy() {
      if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCtx = this.backgroundCanvas.getContext('2d', { willReadFrequently: true })!;
    this.resizeCanvas();
  }

  resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (parent) {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      let tempCanvas: HTMLCanvasElement | null = null;
      if (this.backgroundCanvas.width > 0 && this.backgroundCanvas.height > 0) {
          tempCanvas = document.createElement('canvas');
          tempCanvas.width = this.backgroundCanvas.width;
          tempCanvas.height = this.backgroundCanvas.height;
          tempCanvas.getContext('2d')?.drawImage(this.backgroundCanvas, 0, 0);
      }
      canvas.width = w;
      canvas.height = h;
      this.backgroundCanvas.width = w;
      this.backgroundCanvas.height = h;
      this.backgroundCtx.lineCap = 'round';
      this.backgroundCtx.lineJoin = 'round';
      this.backgroundCtx.lineWidth = 3;
      if (tempCanvas) this.backgroundCtx.drawImage(tempCanvas, 0, 0);
      this.render();
    }
  }

  setTool(t: Tool) { this.tool.set(t); this.deselect(); }
  onColorPick(event: Event) { this.selectedColor.set((event.target as HTMLInputElement).value); }
  toggleShowAuthors() { this.showAuthors.update(v => !v); this.render(); }

  render() {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;
    const boardBg = this.boardInfo()?.backgroundColor || '#ffffff';
    this.ctx.fillStyle = boardBg;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.drawImage(this.backgroundCanvas, 0, 0);
    
    const elements = this.elements();
    const sel = this.selectedElement();
    for (const el of elements) {
      this.ctx.save();
      if (el.type === 'image' && el.image) {
        this.ctx.drawImage(el.image, el.x, el.y, el.width!, el.height!);
      } else if (el.type === 'text' && el.content) {
        const size = el.fontSize || 24;
        this.ctx.font = el.font || `${size}px sans-serif`; 
        if (el.strokeColor && el.strokeColor !== 'transparent' && el.strokeWidth) {
            this.ctx.strokeStyle = el.strokeColor;
            this.ctx.lineWidth = el.strokeWidth;
            this.ctx.strokeText(el.content, el.x, el.y + size);
        }
        this.ctx.fillStyle = el.color || '#000';
        this.ctx.fillText(el.content, el.x, el.y + size); 
      }
      this.ctx.restore();
      if (this.showAuthors() && this.isOwner()) this.drawAuthorLabel(el);
      if (sel && sel.id === el.id) this.drawSelectionBox(el);
    }
  }

  drawAuthorLabel(el: CanvasElement) {
      this.ctx.save();
      const text = el.author || '未知';
      this.ctx.font = '10px sans-serif';
      const m = this.ctx.measureText(text);
      this.ctx.fillStyle = '#6366f1';
      this.ctx.fillRect(el.x, el.y - 18, m.width + 8, 16);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(text, el.x + 4, el.y - 6);
      this.ctx.restore();
  }

  drawSelectionBox(el: CanvasElement) {
    this.ctx.save();
    this.ctx.strokeStyle = '#4F46E5'; this.ctx.lineWidth = 1; this.ctx.setLineDash([5, 5]);
    let w = 0, h = 0;
    if (el.type === 'image') { w = el.width!; h = el.height!; } else {
      const size = el.fontSize || 24;
      this.ctx.font = el.font || `${size}px sans-serif`;
      w = this.ctx.measureText(el.content!).width;
      h = size;
    }
    this.ctx.strokeRect(el.x - 4, el.y - 4, w + 8, h + 8);
    if (el.type === 'image') {
      this.ctx.fillStyle = '#4F46E5'; this.ctx.setLineDash([]); this.ctx.beginPath();
      this.ctx.arc(el.x + w + 4, el.y + h + 4, 6, 0, Math.PI * 2); this.ctx.fill();
    }
    this.ctx.restore();
  }

  getPos(event: MouseEvent | TouchEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const c = (window.TouchEvent && event instanceof TouchEvent) ? event.touches[0] : (event as MouseEvent);
    const scaleX = this.canvasRef.nativeElement.width / rect.width;
    const scaleY = this.canvasRef.nativeElement.height / rect.height;
    return { x: (c.clientX - rect.left) * scaleX, y: (c.clientY - rect.top) * scaleY };
  }

  startAction(event: MouseEvent | TouchEvent) {
    if (window.TouchEvent && event instanceof TouchEvent) event.preventDefault();
    const { x, y } = this.getPos(event);
    const sel = this.selectedElement();
    
    if (sel && sel.type === 'image') {
        const handleX = sel.x + sel.width!; const handleY = sel.y + sel.height!;
        if (Math.sqrt((x-handleX)**2 + (y-handleY)**2) < 20) {
            this.isResizing = true; this.dragStartX = x; this.dragStartY = y;
            this.initialElW = sel.width!; this.initialElH = sel.height!; return;
        }
    }
    if (this.tool() === 'text') {
      if (this.creatingTextPos) this.commitText();
      else { this.creatingTextPos = { x, y }; setTimeout(() => this.textInputRef?.nativeElement?.focus(), 0); }
      return;
    }
    if (this.tool() === 'select') {
      if (sel && this.hitTestElement(sel, x, y)) { this.startDragging(sel, x, y); return; }
      const clickedEl = this.findHitElement(x, y);
      if (clickedEl) { this.selectElement(clickedEl); this.startDragging(clickedEl, x, y); this.render(); }
      else this.deselect();
      return;
    }
    if (this.tool() === 'pen') {
        this.deselect(); this.isDrawing = true;
        this.backgroundCtx.beginPath(); this.backgroundCtx.strokeStyle = this.selectedColor();
        this.backgroundCtx.fillStyle = this.selectedColor(); this.backgroundCtx.moveTo(x, y);
    }
  }

  moveAction(event: MouseEvent | TouchEvent) {
    if (window.TouchEvent && event instanceof TouchEvent) event.preventDefault();
    const { x, y } = this.getPos(event);
    if (this.isResizing && this.selectedElement()) {
       const sel = this.selectedElement()!;
       const dx = x - this.dragStartX;
       const ratio = this.initialElW / this.initialElH;
       let newW = Math.max(20, this.initialElW + dx);
       const newH = newW / ratio;
       // We update local state immediately for smooth drag, but only save on end
       sel.width = newW; sel.height = newH; this.render(); return;
    }
    if (this.isDragging && this.selectedElement()) {
        const sel = this.selectedElement()!;
        const dx = x - this.dragStartX; const dy = y - this.dragStartY;
        sel.x = this.initialElX + dx; sel.y = this.initialElY + dy; this.render(); return;
    }
    if (this.isDrawing && this.tool() === 'pen') {
      this.backgroundCtx.lineTo(x, y); this.backgroundCtx.stroke(); this.render(); 
    }
  }

  endAction() {
    this.isDrawing = false;
    if (this.isDragging || this.isResizing) {
        if (this.selectedElement()) {
            this.dataService.upsertCanvasElement(this.selectedElement()!);
        }
    }
    this.isDragging = false; this.isResizing = false;
  }
  
  findHitElement(x: number, y: number): CanvasElement | null {
    const els = this.elements();
    for (let i = els.length - 1; i >= 0; i--) if (this.hitTestElement(els[i], x, y)) return els[i];
    return null;
  }

  hitTestElement(el: CanvasElement, x: number, y: number): boolean {
    if (el.type === 'image') return x >= el.x && x <= el.x + el.width! && y >= el.y && y <= el.y + el.height!;
    const size = el.fontSize || 24; this.ctx.font = el.font || `${size}px sans-serif`;
    return x >= el.x && x <= el.x + this.ctx.measureText(el.content!).width && y >= el.y && y <= el.y + size;
  }

  startDragging(el: CanvasElement, x: number, y: number) {
      this.isDragging = true; this.dragStartX = x; this.dragStartY = y;
      this.initialElX = el.x; this.initialElY = el.y;
  }

  selectElement(el: CanvasElement) {
      this.selectedElement.set(el); // We modify this object reference locally during drag
      if (el.type === 'text') {
          if (el.fontStyleKey) this.selectedFont.set(el.fontStyleKey as any);
          if (el.fontSize) this.selectedFontSize.set(el.fontSize);
          if (el.color) this.selectedColor.set(el.color);
          this.selectedStrokeColor.set(el.strokeColor || '');
          this.selectedStrokeWidth.set(el.strokeWidth || 2);
      }
  }

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => { this.addImageElement(img, e.target?.result as string); };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(input.files[0]);
    }
    input.value = ''; 
  }

  addImageElement(img: HTMLImageElement, src: string) {
      const canvas = this.canvasRef.nativeElement;
      let w = img.width, h = img.height;
      const maxDim = 300;
      if (w > maxDim || h > maxDim) { const r = w / h; if (w > h) { w = maxDim; h = maxDim / r; } else { h = maxDim; w = maxDim * r; } }
      const el: CanvasElement = {
          id: crypto.randomUUID(), boardId: this.boardInfo()!.id, type: 'image',
          x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, width: w, height: h,
          image: img, imageSrc: src, author: this.currentUser() || 'Unknown'
      };
      this.dataService.upsertCanvasElement(el);
      this.selectElement(el); this.tool.set('select');
  }

  commitText() {
    if (!this.creatingTextPos || !this.textInputRef) return;
    const val = this.textInputRef.nativeElement.value.trim();
    if (val) {
        const styleKey = this.selectedFont();
        const family = this.fontMap[styleKey] || 'Noto Sans SC';
        const size = this.selectedFontSize();
        const el: CanvasElement = {
            id: crypto.randomUUID(), boardId: this.boardInfo()!.id, type: 'text',
            x: this.creatingTextPos.x, y: this.creatingTextPos.y, content: val, color: this.selectedColor(),
            font: `${size}px "${family}"`, fontSize: size, fontStyleKey: styleKey,
            strokeColor: this.selectedStrokeColor(), strokeWidth: this.selectedStrokeWidth(), author: this.currentUser() || 'Unknown'
        };
        this.dataService.upsertCanvasElement(el);
        this.selectElement(el); this.tool.set('select');
    }
    this.creatingTextPos = null; this.render();
  }

  updateSelectedText(changes: Partial<CanvasElement>) {
      const sel = this.selectedElement();
      if (!sel || sel.type !== 'text') return;
      
      const updated = { ...sel, ...changes };
      if (changes.fontStyleKey || changes.fontSize) {
          const key = changes.fontStyleKey || updated.fontStyleKey || 'font-sans';
          const size = changes.fontSize || updated.fontSize || 24;
          const family = this.fontMap[key] || 'Noto Sans SC';
          updated.font = `${size}px "${family}"`;
      }
      this.selectedElement.set(updated);
      this.dataService.upsertCanvasElement(updated);
      this.render();
  }

  deselect() { this.selectedElement.set(null); this.render(); }

  deleteSelected() {
      const sel = this.selectedElement();
      if (!sel) return;
      this.dataService.deleteCanvasElement(sel.id);
      this.deselect();
  }

  moveLayer(direction: 'up' | 'down') { 
      // Supabase sort is usually insertion time unless we add a Z-index column.
      // For this simple version, Z-index is implied by creation time.
      // Implementing real layer reordering requires a 'z_index' column in DB.
      // Skipping for strict "same functionality" relative to local version which used array index.
      // To strictly match, we'd need to update timestamp or z_index in DB.
      alert('云端模式下暂不支持图层调整 (需数据库更新)');
  }

  clearCanvas(clearDb: boolean = true) {
    this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    if (clearDb && this.boardInfo()) this.dataService.clearCanvasElements(this.boardInfo()!.id);
    this.deselect(); this.render();
  }

  async saveBlessing() {
      this.deselect(); 
      const canvas = this.canvasRef.nativeElement;
      const dataUrl = canvas.toDataURL('image/png');
      await this.dataService.addBoardItem(dataUrl);
      alert('已保存版本');
  }

  loadBackground(dataUrl: string) {
      if (!dataUrl) return; 
      const img = new Image();
      img.onload = () => {
          this.clearCanvas(false);
          if (this.backgroundCanvas.width > 0) {
            this.backgroundCtx.drawImage(img, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
            this.render();
          }
      };
      img.src = dataUrl;
  }

  toggleChat() { this.dataService.showChat.update(v => !v); }
  openDownloadModal() { this.showDownloadModal.set(true); }
  confirmDownload() {
      const originalCanvas = this.canvasRef.nativeElement;
      const width = originalCanvas.width; const height = originalCanvas.height;
      const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.drawImage(originalCanvas, 0, 0);
      if (this.includeUrl() || this.includeName()) {
          ctx.save(); const fontSize = Math.max(16, width / 40); 
          ctx.font = `bold ${fontSize}px "Noto Sans SC", sans-serif`;
          ctx.fillStyle = 'rgba(100, 100, 100, 0.8)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          let textY = height - 15; const textX = width - 15;
          if (this.includeUrl()) { ctx.strokeText('https://drawingboard-pearl.vercel.app/', textX, textY); ctx.fillText('https://drawingboard-pearl.vercel.app/', textX, textY); textY -= (fontSize + 8); }
          if (this.includeName()) { const text = `${this.boardInfo()?.title} @${this.boardInfo()?.creator}`; ctx.strokeText(text, textX, textY); ctx.fillText(text, textX, textY); }
          ctx.restore();
      }
      const link = document.createElement('a'); link.download = `board-${Date.now()}.png`; link.href = tempCanvas.toDataURL('image/png'); link.click();
      this.showDownloadModal.set(false);
  }

  async getAiInspiration() {
    this.isGenerating.set(true);
    try {
      const msg = await this.aiService.generateBlessing(['鼓励','幽默','严肃'][Math.floor(Math.random()*3)]);
      const canvas = this.canvasRef.nativeElement;
      const styleKey = this.selectedFont();
      const family = this.fontMap[styleKey] || 'Noto Sans SC';
      const size = this.selectedFontSize();
      const el: CanvasElement = {
          id: crypto.randomUUID(), boardId: this.boardInfo()!.id, type: 'text',
          x: canvas.width/2 - 100, y: canvas.height/2, content: msg, color: this.selectedColor(),
          font: `${size}px "${family}"`, fontSize: size, fontStyleKey: styleKey,
          strokeColor: this.selectedStrokeColor(), strokeWidth: this.selectedStrokeWidth(), author: this.currentUser() || 'AI'
      };
      this.dataService.upsertCanvasElement(el);
    } finally { this.isGenerating.set(false); }
  }
}