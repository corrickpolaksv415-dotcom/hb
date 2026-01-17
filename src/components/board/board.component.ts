import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, signal, effect, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AiService } from '../../services/ai.service';

type Tool = 'select' | 'pen' | 'text'; 
type FontStyle = 'font-sans' | 'font-calligraphy' | 'font-round';

interface BoardElement {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  // Image specific
  image?: HTMLImageElement;
  width?: number;
  height?: number;
  // Text specific
  content?: string;
  font?: string; // Full font string for Canvas (e.g. "24px 'Arial'")
  color?: string;
  
  // New Text Properties
  fontSize?: number;
  fontStyleKey?: FontStyle; // To track selection state
  strokeColor?: string;     // Text outline color
  strokeWidth?: number;     // Text outline width
}

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
           <!-- Download Button -->
           <button (click)="openDownloadModal()" class="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded-full transition-colors" title="下载画板">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
           </button>

           <!-- Chat Button -->
           <button (click)="toggleChat()" class="bg-indigo-600 hover:bg-indigo-500 p-1.5 rounded-full transition-colors" title="聊天">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
           </button>

           <div class="h-4 w-px bg-gray-600"></div>

           <button 
            (click)="saveBlessing()"
            class="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors flex items-center gap-1">
            <span>保存版本</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </button>
        </div>
      </div>

      <!-- Download Modal -->
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
                    <button (click)="confirmDownload()" class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                        下载
                    </button>
                </div>
            </div>
        </div>
      }

      <!-- Toolbar -->
      <div class="flex items-center gap-2 p-2 border-b border-gray-200 bg-gray-50 flex-none overflow-x-auto relative min-h-[52px]">
        
        <!-- Standard Toolbar (Visible when nothing is selected OR select tool is active) -->
        @if (!selectedElement()) {
          <div class="flex items-center gap-2 w-full">
             <!-- Mode Switch -->
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

              <!-- AI Inspiration Button -->
              <div class="h-6 w-px bg-gray-300 mx-1"></div>
              <button 
                (click)="getAiInspiration()"
                [disabled]="isGenerating()"
                class="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs px-2 py-2 rounded transition-all disabled:opacity-50"
                title="AI 灵感生成">
                @if (isGenerating()) { <span class="animate-spin">⌛</span> } @else { <span class="text-sm">✨</span> }
                <span class="hidden sm:inline">AI 灵感</span>
              </button>
            </div>

            <div class="h-6 w-px bg-gray-300"></div>

            <!-- Color Controls -->
            <div class="flex gap-1 items-center">
              @for (color of colors; track color) {
                <button 
                  [style.backgroundColor]="color"
                  class="w-5 h-5 rounded-full border border-gray-200 transition-transform hover:scale-110"
                  [class.ring-2]="selectedColor() === color"
                  [class.ring-gray-400]="selectedColor() === color"
                  (click)="selectedColor.set(color)">
                </button>
              }
              
              <!-- Custom Color Picker -->
              <div class="relative w-5 h-5 rounded-full border border-gray-200 overflow-hidden transition-transform hover:scale-110 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 shadow-sm"
                   [class.ring-2]="!colors.includes(selectedColor())"
                   [class.ring-gray-400]="!colors.includes(selectedColor())">
                <input type="color" [value]="selectedColor()" (input)="onColorPick($event)" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="自定义颜色">
              </div>
            </div>

            <!-- Text Specific Controls for Creation -->
            @if (tool() === 'text') {
              <div class="h-6 w-px bg-gray-300"></div>
              <div class="flex items-center gap-2">
                  <select [ngModel]="selectedFont()" (ngModelChange)="selectedFont.set($event)" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                    <option value="font-sans">黑体</option>
                    <option value="font-calligraphy">书法</option>
                    <option value="font-round">幼圆</option>
                  </select>

                  <select [ngModel]="selectedFontSize()" (ngModelChange)="selectedFontSize.set(+$event)" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                     @for (size of fontSizes; track size) {
                        <option [value]="size">{{ size }}px</option>
                     }
                  </select>
              </div>
            }

            <div class="flex-1"></div>
            <button (click)="clearCanvas()" class="text-xs text-red-500 hover:text-red-700 px-2">清空画板</button>
          </div>
        } @else {
          <!-- Selection Context Toolbar -->
          <div class="flex items-center gap-3 w-full animate-fade-in overflow-x-auto">
            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase whitespace-nowrap">
              {{ selectedElement()?.type === 'image' ? '图片' : '文字' }}
            </span>

            <div class="h-6 w-px bg-gray-300"></div>

            <!-- Text Editing Controls -->
            @if (selectedElement()?.type === 'text') {
               <div class="flex items-center gap-2">
                  <!-- Font Family -->
                  <select [ngModel]="selectedFont()" (ngModelChange)="updateSelectedText({fontStyleKey: $event})" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white max-w-[80px]">
                    <option value="font-sans">黑体</option>
                    <option value="font-calligraphy">书法</option>
                    <option value="font-round">幼圆</option>
                  </select>

                  <!-- Font Size -->
                  <select [ngModel]="selectedFontSize()" (ngModelChange)="updateSelectedText({fontSize: +$event})" class="text-xs border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                     @for (size of fontSizes; track size) {
                        <option [value]="size">{{ size }}px</option>
                     }
                  </select>
                  
                  <!-- Color -->
                  <div class="relative w-5 h-5 rounded border border-gray-300 overflow-hidden cursor-pointer" [style.backgroundColor]="selectedColor()">
                     <input type="color" [value]="selectedColor()" (input)="updateSelectedText({color: $any($event.target).value})" class="absolute inset-0 opacity-0 w-full h-full">
                  </div>

                  <div class="h-4 w-px bg-gray-200"></div>
                  
                  <!-- Stroke Controls -->
                  <div class="flex items-center gap-1 bg-gray-100 p-1 rounded">
                     <span class="text-[10px] text-gray-500 font-bold px-1">描边</span>
                     <!-- Stroke Color -->
                     <div class="relative w-5 h-5 rounded border border-gray-300 overflow-hidden cursor-pointer bg-white">
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none" *ngIf="!selectedStrokeColor() || selectedStrokeColor() === 'transparent'">
                           <div class="w-full h-px bg-red-500 rotate-45"></div>
                        </div>
                        <div *ngIf="selectedStrokeColor() && selectedStrokeColor() !== 'transparent'" class="w-full h-full" [style.backgroundColor]="selectedStrokeColor()"></div>
                        <input type="color" [value]="selectedStrokeColor() || '#000000'" (input)="updateSelectedText({strokeColor: $any($event.target).value})" class="absolute inset-0 opacity-0 w-full h-full">
                     </div>
                     
                     <!-- Stroke Width -->
                     <input type="number" [ngModel]="selectedStrokeWidth()" (ngModelChange)="updateSelectedText({strokeWidth: $event})" min="0" max="10" class="w-10 text-xs border border-gray-300 rounded px-1 py-0.5 outline-none text-center">
                  </div>
               </div>
               <div class="h-6 w-px bg-gray-300"></div>
            }

            <!-- Layer Controls -->
            <div class="flex items-center gap-1">
              <button (click)="moveLayer('up')" class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded" title="上移一层">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
              </button>
              <button (click)="moveLayer('down')" class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded" title="下移一层">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
            </div>
            
            <div class="h-6 w-px bg-gray-300"></div>

            <button (click)="deleteSelected()" class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
               删除
            </button>

            <div class="flex-1"></div>
            <button (click)="deselect()" class="text-xs text-gray-500 hover:text-gray-800 px-2 whitespace-nowrap">完成</button>
          </div>
        }
      </div>

      <!-- Canvas Area -->
      <div class="relative flex-1 bg-white cursor-crosshair touch-none overflow-hidden group w-full">
        <canvas #canvas 
          (mousedown)="startAction($event)" 
          (mousemove)="moveAction($event)" 
          (mouseup)="endAction()" 
          (mouseleave)="endAction()"
          (touchstart)="startAction($event)"
          (touchmove)="moveAction($event)"
          (touchend)="endAction()"
          class="block w-full h-full">
        </canvas>

        <!-- Input for NEW text only -->
        @if (creatingTextPos) {
          <input 
            #textInput
            type="text"
            [style.top.px]="creatingTextPos.y"
            [style.left.px]="creatingTextPos.x"
            [style.color]="selectedColor()"
            [style.font-size.px]="selectedFontSize()"
            [class]="selectedFont() + ' absolute bg-transparent border-b border-dashed border-gray-400 outline-none p-0 z-50'"
            (blur)="commitText()"
            (keydown.enter)="textInput.blur()"
            placeholder="输入..."
            autofocus
          />
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
  
  // -- State --
  tool = signal<Tool>('pen');
  colors = ['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  selectedColor = signal('#000000');
  
  // Font State
  fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
  selectedFont = signal<FontStyle>('font-sans');
  selectedFontSize = signal(24);
  
  // Stroke State
  selectedStrokeColor = signal<string>(''); // empty or transparent means no stroke
  selectedStrokeWidth = signal(2);

  isGenerating = signal(false);

  // Download State
  showDownloadModal = signal(false);
  includeUrl = signal(true);
  includeName = signal(true);

  // -- Canvas System --
  private ctx!: CanvasRenderingContext2D; // Main display context
  
  // Layer 0: The "Background" (Pen strokes)
  private backgroundCanvas!: HTMLCanvasElement;
  private backgroundCtx!: CanvasRenderingContext2D;
  private resizeObserver!: ResizeObserver;

  // Layer 1..N: Elements
  elements = signal<BoardElement[]>([]);
  selectedElement = signal<BoardElement | null>(null);

  // -- Interaction State --
  private isDrawing = false;
  private isDragging = false;
  private isResizing = false;
  
  // Dragging/Resizing Data
  private dragStartX = 0;
  private dragStartY = 0;
  private initialElX = 0;
  private initialElY = 0;
  private initialElW = 0;
  private initialElH = 0;

  // New Text Creation
  creatingTextPos: {x: number, y: number} | null = null;
  
  private readonly fontMap: Record<string, string> = {
    'font-sans': 'Noto Sans SC',
    'font-calligraphy': 'Ma Shan Zheng',
    'font-round': 'ZCOOL KuaiLe'
  };

  ngAfterViewInit() {
    this.initCanvas();
    
    // Robust Resizing
    this.resizeObserver = new ResizeObserver(() => {
        // Debounce slightly or just run
        requestAnimationFrame(() => this.resizeCanvas());
    });
    
    if (this.canvasRef.nativeElement.parentElement) {
        this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement);
    }
    
    effect(() => {
        const blessings = this.dataService.currentBoardBlessings();
        const activeBoard = this.dataService.activeBoard();

        if (blessings.length > 0) {
            let targetItem = blessings[0]; // Default to latest
            
            // If board has a specific active version, try to find it
            if (activeBoard?.activeVersionId) {
                const found = blessings.find(b => b.id === activeBoard.activeVersionId);
                if (found) targetItem = found;
            }
            
            // Wait for next tick to ensure canvas might be resized
            setTimeout(() => {
                this.loadBackground(targetItem.imageData);
            }, 100);
        }
    }, { injector: this.injector });
  }

  ngOnDestroy() {
      if (this.resizeObserver) {
          this.resizeObserver.disconnect();
      }
  }

  // --- Initialization ---

  initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    // Create offscreen buffer for pen strokes
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
      
      if (w === 0 || h === 0) return; // Do not resize to 0

      // 1. Save current background content if dimensions exist
      let tempCanvas: HTMLCanvasElement | null = null;
      if (this.backgroundCanvas.width > 0 && this.backgroundCanvas.height > 0) {
          tempCanvas = document.createElement('canvas');
          tempCanvas.width = this.backgroundCanvas.width;
          tempCanvas.height = this.backgroundCanvas.height;
          tempCanvas.getContext('2d')?.drawImage(this.backgroundCanvas, 0, 0);
      }

      // 2. Resize Display Canvas
      canvas.width = w;
      canvas.height = h;

      // 3. Resize Background Canvas
      this.backgroundCanvas.width = w;
      this.backgroundCanvas.height = h;

      // 4. Restore background content
      this.backgroundCtx.lineCap = 'round';
      this.backgroundCtx.lineJoin = 'round';
      this.backgroundCtx.lineWidth = 3;
      
      if (tempCanvas) {
         this.backgroundCtx.drawImage(tempCanvas, 0, 0);
      }

      this.render();
    }
  }

  setTool(t: Tool) {
    this.tool.set(t);
    this.deselect();
  }

  onColorPick(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedColor.set(input.value);
  }

  // --- Rendering Loop ---

  render() {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width;
    const h = canvas.height;
    
    // Safety check
    if (w === 0 || h === 0) return;

    // Get board background preference (default to white)
    const boardBg = this.boardInfo()?.backgroundColor || '#ffffff';

    // 1. Clear Display & Fill Background
    this.ctx.fillStyle = boardBg;
    this.ctx.fillRect(0, 0, w, h);

    // 2. Draw Background (Pen Layer)
    this.ctx.drawImage(this.backgroundCanvas, 0, 0);

    // 3. Draw Elements (Bottom to Top)
    const elements = this.elements();
    const sel = this.selectedElement();

    for (const el of elements) {
      this.ctx.save();
      if (el.type === 'image' && el.image) {
        this.ctx.drawImage(el.image, el.x, el.y, el.width!, el.height!);
      } else if (el.type === 'text' && el.content) {
        // Construct font string dynamically if props exist
        const size = el.fontSize || 24;
        // Use stored font string or fallback
        this.ctx.font = el.font || `${size}px sans-serif`; 
        
        // Stroke (Outline)
        if (el.strokeColor && el.strokeColor !== 'transparent' && el.strokeWidth && el.strokeWidth > 0) {
            this.ctx.strokeStyle = el.strokeColor;
            this.ctx.lineWidth = el.strokeWidth;
            this.ctx.strokeText(el.content, el.x, el.y + size);
        }

        // Fill
        this.ctx.fillStyle = el.color || '#000';
        // Baseline adjustment: draw at y + fontSize because ctx default baseline is alphabetic
        this.ctx.fillText(el.content, el.x, el.y + size); 
      }
      this.ctx.restore();

      // Draw Selection Box
      if (sel && sel.id === el.id) {
        this.drawSelectionBox(el);
      }
    }
  }

  drawSelectionBox(el: BoardElement) {
    this.ctx.save();
    this.ctx.strokeStyle = '#4F46E5'; // Indigo
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);

    let w = 0, h = 0;
    if (el.type === 'image') {
      w = el.width!;
      h = el.height!;
    } else {
      // Estimate text dimensions
      // Important: Use same font settings as render
      const size = el.fontSize || 24;
      this.ctx.font = el.font || `${size}px sans-serif`;
      const metrics = this.ctx.measureText(el.content!);
      w = metrics.width;
      h = size; // Height approx = size
    }

    // Box
    this.ctx.strokeRect(el.x - 4, el.y - 4, w + 8, h + 8);

    // Resize Handle (Only for images)
    if (el.type === 'image') {
      this.ctx.fillStyle = '#4F46E5';
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.arc(el.x + w + 4, el.y + h + 4, 6, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  // --- Interaction Logic ---

  getPos(event: MouseEvent | TouchEvent): {x: number, y: number} {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (window.TouchEvent && event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      const me = event as MouseEvent;
      clientX = me.clientX;
      clientY = me.clientY;
    }

    // Coordinate Mapping
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    };
  }

  startAction(event: MouseEvent | TouchEvent) {
    if (window.TouchEvent && event instanceof TouchEvent) event.preventDefault();
    const { x, y } = this.getPos(event);

    // A. Handle Resizing (Selection Mode)
    const sel = this.selectedElement();
    if (sel && sel.type === 'image') {
        const handleX = sel.x + sel.width!;
        const handleY = sel.y + sel.height!;
        const dist = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2));
        
        if (dist < 20) {
            this.isResizing = true;
            this.dragStartX = x;
            this.dragStartY = y;
            this.initialElW = sel.width!;
            this.initialElH = sel.height!;
            return;
        }
    }

    // B. Handle Text Creation (Text Tool)
    if (this.tool() === 'text') {
      if (this.creatingTextPos) {
        this.commitText();
      } else {
        this.creatingTextPos = { x, y };
        setTimeout(() => this.textInputRef?.nativeElement?.focus(), 0);
      }
      return;
    }

    // C. Handle Selection / Dragging (Select Tool or default click)
    if (this.tool() === 'select') {
      if (sel && this.hitTestElement(sel, x, y)) {
          this.startDragging(sel, x, y);
          return;
      }
      
      const clickedEl = this.findHitElement(x, y);
      if (clickedEl) {
        this.selectElement(clickedEl); // Helper to set state
        this.startDragging(clickedEl, x, y);
        this.render();
      } else {
        this.deselect();
      }
      return;
    }

    // D. Handle Painting (Pen Tool)
    if (this.tool() === 'pen') {
        this.deselect();
        this.isDrawing = true;
        this.backgroundCtx.beginPath();
        this.backgroundCtx.strokeStyle = this.selectedColor();
        this.backgroundCtx.fillStyle = this.selectedColor();
        this.backgroundCtx.moveTo(x, y);
    }
  }

  moveAction(event: MouseEvent | TouchEvent) {
    if (window.TouchEvent && event instanceof TouchEvent) event.preventDefault();
    const { x, y } = this.getPos(event);

    if (this.isResizing && this.selectedElement()) {
       const sel = this.selectedElement()!;
       const dx = x - this.dragStartX;
       const ratio = this.initialElW / this.initialElH;
       let newW = this.initialElW + dx;
       if (newW < 20) newW = 20;
       const newH = newW / ratio;
       
       sel.width = newW;
       sel.height = newH;
       this.render();
       return;
    }

    if (this.isDragging && this.selectedElement()) {
        const sel = this.selectedElement()!;
        const dx = x - this.dragStartX;
        const dy = y - this.dragStartY;
        sel.x = this.initialElX + dx;
        sel.y = this.initialElY + dy;
        this.render();
        return;
    }

    if (this.isDrawing && this.tool() === 'pen') {
      this.backgroundCtx.lineTo(x, y);
      this.backgroundCtx.stroke();
      this.render(); 
    }
  }

  endAction() {
    this.isDrawing = false;
    this.isDragging = false;
    this.isResizing = false;
  }

  // --- Helpers ---
  
  findHitElement(x: number, y: number): BoardElement | null {
    const els = this.elements();
    for (let i = els.length - 1; i >= 0; i--) {
        if (this.hitTestElement(els[i], x, y)) {
            return els[i];
        }
    }
    return null;
  }

  hitTestElement(el: BoardElement, x: number, y: number): boolean {
    if (el.type === 'image') {
        return x >= el.x && x <= el.x + el.width! &&
               y >= el.y && y <= el.y + el.height!;
    } else {
        const size = el.fontSize || 24;
        this.ctx.font = el.font || `${size}px sans-serif`;
        const m = this.ctx.measureText(el.content!);
        // Box is [x, y] to [x + width, y + fontSize]
        return x >= el.x && x <= el.x + m.width &&
               y >= el.y && y <= el.y + size;
    }
  }

  startDragging(el: BoardElement, x: number, y: number) {
      this.isDragging = true;
      this.dragStartX = x;
      this.dragStartY = y;
      this.initialElX = el.x;
      this.initialElY = el.y;
  }

  selectElement(el: BoardElement) {
      this.selectedElement.set(el);
      if (el.type === 'text') {
          // Sync toolbar state
          if (el.fontStyleKey) this.selectedFont.set(el.fontStyleKey);
          if (el.fontSize) this.selectedFontSize.set(el.fontSize);
          if (el.color) this.selectedColor.set(el.color);
          this.selectedStrokeColor.set(el.strokeColor || '');
          this.selectedStrokeWidth.set(el.strokeWidth || 2);
      }
  }

  // --- Element Management ---

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.addImageElement(img);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(input.files[0]);
    }
    input.value = ''; 
  }

  addImageElement(img: HTMLImageElement) {
      const canvas = this.canvasRef.nativeElement;
      let w = img.width;
      let h = img.height;
      const maxDim = 300;
      if (w > maxDim || h > maxDim) {
         const ratio = w / h;
         if (w > h) { w = maxDim; h = maxDim / ratio; }
         else { h = maxDim; w = maxDim * ratio; }
      }

      const el: BoardElement = {
          id: crypto.randomUUID(),
          type: 'image',
          x: (canvas.width - w) / 2,
          y: (canvas.height - h) / 2,
          width: w,
          height: h,
          image: img
      };

      this.elements.update(prev => [...prev, el]);
      this.selectElement(el);
      this.tool.set('select');
      this.render();
  }

  commitText() {
    if (!this.creatingTextPos || !this.textInputRef) return;
    const val = this.textInputRef.nativeElement.value.trim();
    
    if (val) {
        const styleKey = this.selectedFont();
        const family = this.fontMap[styleKey] || 'Noto Sans SC';
        const size = this.selectedFontSize();
        
        const el: BoardElement = {
            id: crypto.randomUUID(),
            type: 'text',
            x: this.creatingTextPos.x,
            y: this.creatingTextPos.y,
            content: val,
            color: this.selectedColor(),
            font: `${size}px "${family}"`,
            fontSize: size,
            fontStyleKey: styleKey,
            strokeColor: this.selectedStrokeColor(),
            strokeWidth: this.selectedStrokeWidth()
        };
        
        this.elements.update(prev => [...prev, el]);
        this.selectElement(el);
        this.tool.set('select');
    }
    
    this.creatingTextPos = null;
    this.render();
  }

  // Update selected text element properties
  updateSelectedText(changes: Partial<BoardElement>) {
      const sel = this.selectedElement();
      if (!sel || sel.type !== 'text') return;

      this.elements.update(prev => prev.map(el => {
          if (el.id === sel.id) {
              const updated = { ...el, ...changes };
              
              // Re-construct font string if needed
              if (changes.fontStyleKey || changes.fontSize) {
                  const key = changes.fontStyleKey || updated.fontStyleKey || 'font-sans';
                  const size = changes.fontSize || updated.fontSize || 24;
                  const family = this.fontMap[key] || 'Noto Sans SC';
                  updated.font = `${size}px "${family}"`;
              }

              // Update local selection reference too so UI stays consistent
              this.selectedElement.set(updated);
              
              // Update Toolbar inputs if externally changed (e.g. by undo/redo logic in future)
              // But here we are the source of change, so usually fine.
              if (changes.fontStyleKey) this.selectedFont.set(changes.fontStyleKey);
              if (changes.fontSize) this.selectedFontSize.set(changes.fontSize);
              if (changes.color) this.selectedColor.set(changes.color);
              if (changes.strokeColor !== undefined) this.selectedStrokeColor.set(changes.strokeColor);
              if (changes.strokeWidth !== undefined) this.selectedStrokeWidth.set(changes.strokeWidth);

              return updated;
          }
          return el;
      }));
      this.render();
  }

  // --- Layering & Deletion ---

  deselect() {
      this.selectedElement.set(null);
      this.render();
  }

  deleteSelected() {
      const sel = this.selectedElement();
      if (!sel) return;
      this.elements.update(prev => prev.filter(e => e.id !== sel.id));
      this.deselect();
  }

  moveLayer(direction: 'up' | 'down') {
      const sel = this.selectedElement();
      if (!sel) return;
      
      this.elements.update(prev => {
          const idx = prev.findIndex(e => e.id === sel.id);
          if (idx === -1) return prev;
          
          const newArr = [...prev];
          if (direction === 'up' && idx < newArr.length - 1) {
              [newArr[idx], newArr[idx+1]] = [newArr[idx+1], newArr[idx]];
          } else if (direction === 'down' && idx > 0) {
              [newArr[idx], newArr[idx-1]] = [newArr[idx-1], newArr[idx]];
          }
          return newArr;
      });
      this.render();
  }

  // --- Saving & Loading ---

  clearCanvas() {
    this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    this.elements.set([]);
    this.deselect();
    this.render();
  }

  saveBlessing() {
      this.deselect(); 
      const canvas = this.canvasRef.nativeElement;
      const dataUrl = canvas.toDataURL('image/png');
      this.dataService.addBoardItem(dataUrl);
  }

  loadBackground(dataUrl: string) {
      const img = new Image();
      img.onload = () => {
          this.clearCanvas();
          // Ensure we don't draw on 0x0
          if (this.backgroundCanvas.width === 0 || this.backgroundCanvas.height === 0) {
              this.resizeCanvas();
          }
          if (this.backgroundCanvas.width > 0 && this.backgroundCanvas.height > 0) {
            this.backgroundCtx.drawImage(img, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
            this.render();
          }
      };
      img.src = dataUrl;
  }

  toggleChat() {
    this.dataService.showChat.update(v => !v);
  }

  // --- Download & Watermark ---

  openDownloadModal() {
      this.showDownloadModal.set(true);
  }

  confirmDownload() {
      const originalCanvas = this.canvasRef.nativeElement;
      const width = originalCanvas.width;
      const height = originalCanvas.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d')!;

      // Draw original
      ctx.drawImage(originalCanvas, 0, 0);

      // Add Watermarks
      if (this.includeUrl() || this.includeName()) {
          ctx.save();
          // Scale font size based on canvas width
          const fontSize = Math.max(16, width / 40); 
          ctx.font = `bold ${fontSize}px "Noto Sans SC", sans-serif`;
          ctx.fillStyle = 'rgba(100, 100, 100, 0.8)'; // Semi-transparent grey
          // Add a white stroke for visibility on dark backgrounds
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';

          let textY = height - 15;
          const textX = width - 15;

          if (this.includeUrl()) {
             const url = 'https://drawingboard-pearl.vercel.app/';
             ctx.strokeText(url, textX, textY);
             ctx.fillText(url, textX, textY);
             textY -= (fontSize + 8);
          }

          if (this.includeName()) {
             const title = this.boardInfo()?.title || '未命名画板';
             const author = this.boardInfo()?.creator || '匿名';
             const text = `${title} @${author}`;
             ctx.strokeText(text, textX, textY);
             ctx.fillText(text, textX, textY);
          }
          ctx.restore();
      }

      // Download
      const link = document.createElement('a');
      link.download = `board-${Date.now()}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
      
      this.showDownloadModal.set(false);
  }

  // --- AI ---
  async getAiInspiration() {
    this.isGenerating.set(true);
    const moods = ['鼓励的', '幽默的', '严肃的', '诗意的', '自信的'];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    
    try {
      const msg = await this.aiService.generateBlessing(randomMood);
      
      const canvas = this.canvasRef.nativeElement;
      const x = canvas.width / 2 - 100;
      const y = canvas.height / 2;

      const styleKey = this.selectedFont();
      const family = this.fontMap[styleKey] || 'Noto Sans SC';
      const size = this.selectedFontSize();

      const el: BoardElement = {
          id: crypto.randomUUID(),
          type: 'text',
          x, y,
          content: msg,
          color: this.selectedColor(),
          font: `${size}px "${family}"`,
          fontSize: size,
          fontStyleKey: styleKey,
          strokeColor: this.selectedStrokeColor(),
          strokeWidth: this.selectedStrokeWidth()
      };
      
      this.elements.update(prev => [...prev, el]);
      this.selectElement(el);
      this.tool.set('select');
      this.render();

    } finally {
      this.isGenerating.set(false);
    }
  }
}