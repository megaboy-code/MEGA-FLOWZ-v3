const c=class c{constructor(t={}){if(this.container=null,this.canvas=null,this.ctx=null,this.currentHue=210,this.currentSaturation=.7,this.currentBrightness=.9,this.currentOpacity=1,this.currentHex="#3b82f6",this.isDraggingCanvas=!1,this.isDraggingHue=!1,this.isDraggingOpacity=!1,this.handleOutsideClick=e=>{this.container&&!this.container.contains(e.target)&&(this.saveRecentColor(this.currentHex),this.close(),this.options.onClose&&this.options.onClose())},this.options=t,t.color){const e=this.hexToHsb(t.color);this.currentHue=e.h,this.currentSaturation=e.s,this.currentBrightness=e.b,this.currentHex=t.color}t.opacity!==void 0&&(this.currentOpacity=t.opacity),this.injectStyles()}open(t){this.close(),this.createPicker(t)}close(){this.container&&document.body.contains(this.container)&&(this.container.classList.add("cp-closing"),setTimeout(()=>{this.container&&document.body.contains(this.container)&&document.body.removeChild(this.container),this.container=null,this.canvas=null,this.ctx=null},150)),document.removeEventListener("mousedown",this.handleOutsideClick)}createPicker(t){var e;this.container=document.createElement("div"),this.container.className="cp-container",this.container.innerHTML=`
      <div class="cp-gradient-wrap">
        <canvas class="cp-canvas" width="220" height="150"></canvas>
        <div class="cp-canvas-cursor"></div>
      </div>
      <div class="cp-sliders">
        <div class="cp-hue-slider">
          <div class="cp-hue-thumb"></div>
        </div>
        <div class="cp-opacity-slider">
          <div class="cp-opacity-track"></div>
          <div class="cp-opacity-thumb"></div>
        </div>
      </div>
      <div class="cp-preview-row">
        <div class="cp-preview-swatch">
          <div class="cp-preview-swatch-inner"></div>
        </div>
        <input class="cp-hex-input" type="text" maxlength="7" placeholder="#000000" />
        <input class="cp-opacity-input" type="number" min="0" max="100" />
        <span class="cp-opacity-label">%</span>
      </div>
      <div class="cp-divider"></div>
      <div class="cp-presets">
        ${c.PRESETS.map(i=>`<div class="cp-swatch" style="background:${i}" data-color="${i}"></div>`).join("")}
      </div>
      <div class="cp-recents-wrap">
        <div class="cp-recents-title">Recent</div>
        <div class="cp-recents"></div>
      </div>
    `,document.body.appendChild(this.container),this.canvas=this.container.querySelector(".cp-canvas"),this.ctx=((e=this.canvas)==null?void 0:e.getContext("2d"))||null,this.fullUpdate(),this.renderRecents(),this.positionPicker(t),this.setupCanvasEvents(),this.setupHueEvents(),this.setupOpacityEvents(),this.setupHexInput(),this.setupOpacityInput(),this.setupSwatches(),setTimeout(()=>{document.addEventListener("mousedown",this.handleOutsideClick)},0)}positionPicker(t){if(!this.container)return;const e=t.getBoundingClientRect(),i=240,r=this.container.offsetHeight||380;let n=e.right-i,s=e.top-r-8;n<8&&(n=8),s<8&&(s=e.bottom+8),n+i>window.innerWidth&&(n=window.innerWidth-i-8),s+r>window.innerHeight&&(s=window.innerHeight-r-8),this.container.style.left=`${n}px`,this.container.style.top=`${s}px`}renderCanvas(){if(!this.ctx||!this.canvas)return;const t=this.canvas.width,e=this.canvas.height,i=this.ctx.createLinearGradient(0,0,t,0);i.addColorStop(0,"rgba(255,255,255,1)"),i.addColorStop(1,`hsl(${this.currentHue}, 100%, 50%)`),this.ctx.fillStyle=i,this.ctx.fillRect(0,0,t,e);const r=this.ctx.createLinearGradient(0,0,0,e);r.addColorStop(0,"rgba(0,0,0,0)"),r.addColorStop(1,"rgba(0,0,0,1)"),this.ctx.fillStyle=r,this.ctx.fillRect(0,0,t,e)}updateCursor(){if(!this.container||!this.canvas)return;const t=this.container.querySelector(".cp-canvas-cursor");t&&(t.style.left=`${this.currentSaturation*this.canvas.width}px`,t.style.top=`${(1-this.currentBrightness)*this.canvas.height}px`)}updateHueThumb(){if(!this.container)return;const t=this.container.querySelector(".cp-hue-thumb");t&&(t.style.left=`${this.currentHue/360*100}%`)}updateOpacityTrack(){if(!this.container)return;const t=this.container.querySelector(".cp-opacity-track");t&&(t.style.background=`linear-gradient(to right, transparent, ${this.currentHex})`)}updateOpacityThumb(){if(!this.container)return;const t=this.container.querySelector(".cp-opacity-thumb");t&&(t.style.left=`${this.currentOpacity*100}%`)}updatePreview(){if(!this.container)return;const t=this.container.querySelector(".cp-preview-swatch-inner"),e=this.container.querySelector(".cp-hex-input"),i=this.container.querySelector(".cp-opacity-input"),[r,n,s]=this.hexToRgb(this.currentHex);t&&(t.style.background=`rgba(${r},${n},${s},${this.currentOpacity})`),e&&document.activeElement!==e&&(e.value=this.currentHex),i&&document.activeElement!==i&&(i.value=`${Math.round(this.currentOpacity*100)}`)}fullUpdate(){this.renderCanvas(),this.updateCursor(),this.updateHueThumb(),this.updateOpacityTrack(),this.updateOpacityThumb(),this.updatePreview()}setupCanvasEvents(){if(!this.canvas)return;const t=e=>{if(!this.isDraggingCanvas||!this.canvas)return;const i=this.canvas.getBoundingClientRect(),r=Math.max(0,Math.min(e.clientX-i.left,i.width)),n=Math.max(0,Math.min(e.clientY-i.top,i.height));this.currentSaturation=r/i.width,this.currentBrightness=1-n/i.height,this.currentHex=this.hsbToHex(this.currentHue,this.currentSaturation,this.currentBrightness),this.updateCursor(),this.updateOpacityTrack(),this.updatePreview(),this.emitChange()};this.canvas.addEventListener("mousedown",e=>{this.isDraggingCanvas=!0,t(e)}),document.addEventListener("mousemove",t),document.addEventListener("mouseup",()=>{this.isDraggingCanvas=!1})}setupHueEvents(){if(!this.container)return;const t=this.container.querySelector(".cp-hue-slider");if(!t)return;const e=i=>{if(!this.isDraggingHue)return;const r=t.getBoundingClientRect(),n=Math.max(0,Math.min(i.clientX-r.left,r.width));this.currentHue=Math.round(n/r.width*360),this.currentHex=this.hsbToHex(this.currentHue,this.currentSaturation,this.currentBrightness),this.renderCanvas(),this.updateHueThumb(),this.updateOpacityTrack(),this.updatePreview(),this.emitChange()};t.addEventListener("mousedown",i=>{this.isDraggingHue=!0,e(i)}),document.addEventListener("mousemove",e),document.addEventListener("mouseup",()=>{this.isDraggingHue=!1})}setupOpacityEvents(){if(!this.container)return;const t=this.container.querySelector(".cp-opacity-slider");if(!t)return;const e=i=>{if(!this.isDraggingOpacity)return;const r=t.getBoundingClientRect(),n=Math.max(0,Math.min(i.clientX-r.left,r.width));this.currentOpacity=parseFloat((n/r.width).toFixed(2)),this.updateOpacityThumb(),this.updatePreview(),this.emitChange()};t.addEventListener("mousedown",i=>{this.isDraggingOpacity=!0,e(i)}),document.addEventListener("mousemove",e),document.addEventListener("mouseup",()=>{this.isDraggingOpacity=!1})}setupHexInput(){if(!this.container)return;const t=this.container.querySelector(".cp-hex-input");t&&(t.addEventListener("input",()=>{const e=t.value.trim();/^#[0-9a-fA-F]{6}$/.test(e)&&this.setColor(e,this.currentOpacity)}),t.addEventListener("keydown",e=>{e.key==="Enter"&&t.blur()}))}setupOpacityInput(){if(!this.container)return;const t=this.container.querySelector(".cp-opacity-input");t&&t.addEventListener("input",()=>{const e=parseInt(t.value);!isNaN(e)&&e>=0&&e<=100&&(this.currentOpacity=e/100,this.updateOpacityThumb(),this.updatePreview(),this.emitChange())})}setupSwatches(){this.container&&this.container.querySelectorAll(".cp-presets .cp-swatch").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.color;this.setColor(e,this.currentOpacity)})})}renderRecents(){if(!this.container)return;const t=this.container.querySelector(".cp-recents");if(!t)return;const e=this.getRecentColors();t.innerHTML=e.map(i=>`<div class="cp-swatch" style="background:${i}" data-color="${i}"></div>`).join(""),t.querySelectorAll(".cp-swatch").forEach(i=>{i.addEventListener("click",()=>{const r=i.dataset.color;this.setColor(r,this.currentOpacity)})})}setColor(t,e=1){this.currentHex=t,this.currentOpacity=e;const i=this.hexToHsb(t);this.currentHue=i.h,this.currentSaturation=i.s,this.currentBrightness=i.b,this.fullUpdate(),this.emitChange()}getColor(){return{hex:this.currentHex,opacity:this.currentOpacity}}emitChange(){this.options.onChange&&this.options.onChange(this.currentHex,this.currentOpacity)}getRecentColors(){try{return JSON.parse(localStorage.getItem(c.RECENT_COLORS_KEY)||"[]")}catch{return[]}}saveRecentColor(t){const e=this.getRecentColors().filter(i=>i!==t);e.unshift(t),e.splice(c.MAX_RECENT);try{localStorage.setItem(c.RECENT_COLORS_KEY,JSON.stringify(e))}catch{}}hexToRgb(t){const e=t.replace("#","");return[parseInt(e.substring(0,2),16),parseInt(e.substring(2,4),16),parseInt(e.substring(4,6),16)]}hexToHsb(t){const[e,i,r]=this.hexToRgb(t).map(h=>h/255),n=Math.max(e,i,r),s=Math.min(e,i,r),o=n-s;let a=0;return o!==0&&(n===e?a=(i-r)/o%6:n===i?a=(r-e)/o+2:a=(e-i)/o+4,a=Math.round(a*60),a<0&&(a+=360)),{h:a,s:n===0?0:o/n,b:n}}hsbToHex(t,e,i){const r=a=>{const h=(a+t/60)%6;return i-i*e*Math.max(0,Math.min(h,4-h,1))},n=Math.round(r(5)*255),s=Math.round(r(3)*255),o=Math.round(r(1)*255);return`#${n.toString(16).padStart(2,"0")}${s.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}`}injectStyles(){if(document.getElementById("cp-styles"))return;const t=document.createElement("style");t.id="cp-styles",t.textContent=`
      .cp-container {
        position: fixed;
        width: 240px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 10px;
        box-shadow: var(--card-shadow);
        z-index: 99999;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-family: var(--text-sans);
        animation: cpFadeIn 0.15s ease;
      }

      .cp-container.cp-closing {
        animation: cpFadeOut 0.15s ease forwards;
      }

      @keyframes cpFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      @keyframes cpFadeOut {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(6px); }
      }

      .cp-gradient-wrap {
        position: relative;
        width: 100%;
        height: 150px;
        border-radius: 6px;
        overflow: hidden;
        cursor: crosshair;
      }

      .cp-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .cp-canvas-cursor {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      .cp-sliders {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .cp-hue-slider {
        position: relative;
        height: 10px;
        border-radius: 5px;
        background: linear-gradient(to right,
          hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
          hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
          hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
          hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
          hsl(360,100%,50%)
        );
        cursor: pointer;
      }

      .cp-hue-thumb {
        position: absolute;
        top: 50%;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: white;
        border: 2px solid white;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      .cp-opacity-slider {
        position: relative;
        height: 10px;
        border-radius: 5px;
        background-image: linear-gradient(45deg, #808080 25%, transparent 25%),
          linear-gradient(-45deg, #808080 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #808080 75%),
          linear-gradient(-45deg, transparent 75%, #808080 75%);
        background-size: 8px 8px;
        background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
        background-color: #b0b0b0;
        cursor: pointer;
        overflow: hidden;
      }

      .cp-opacity-track {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        border-radius: 5px;
      }

      .cp-opacity-thumb {
        position: absolute;
        top: 50%;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: white;
        border: 2px solid white;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      .cp-preview-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .cp-preview-swatch {
        width: 28px;
        height: 28px;
        border-radius: 5px;
        border: 1px solid var(--border);
        flex-shrink: 0;
        background-image: linear-gradient(45deg, #808080 25%, transparent 25%),
          linear-gradient(-45deg, #808080 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #808080 75%),
          linear-gradient(-45deg, transparent 75%, #808080 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
        background-color: #b0b0b0;
        position: relative;
        overflow: hidden;
      }

      .cp-preview-swatch-inner {
        position: absolute;
        inset: 0;
      }

      .cp-hex-input {
        flex: 1;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 5px;
        color: var(--text-primary);
        font-size: var(--text-sm);
        font-family: var(--text-mono);
        padding: 5px 8px;
        outline: none;
        transition: border-color 0.2s;
      }

      .cp-hex-input:focus {
        border-color: var(--accent-info);
      }

      .cp-opacity-input {
        width: 42px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 5px;
        color: var(--text-primary);
        font-size: var(--text-sm);
        font-family: var(--text-mono);
        padding: 5px 4px;
        outline: none;
        text-align: center;
        transition: border-color 0.2s;
      }

      .cp-opacity-input:focus {
        border-color: var(--accent-info);
      }

      .cp-opacity-label {
        font-size: var(--text-xs);
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .cp-divider {
        height: 1px;
        background: var(--border);
      }

      .cp-presets {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 4px;
      }

      .cp-swatch {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 3px;
        cursor: pointer;
        border: 1px solid var(--border);
        transition: transform 0.1s ease, border-color 0.1s ease;
      }

      .cp-swatch:hover {
        transform: scale(1.2);
        border-color: var(--text-primary);
      }

      .cp-recents-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cp-recents-title {
        font-size: var(--text-xs);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text-muted);
      }

      .cp-recents {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        min-height: 20px;
      }

      .cp-recents .cp-swatch {
        width: 20px;
        height: 20px;
      }
    `,document.head.appendChild(t)}destroy(){this.close()}};c.RECENT_COLORS_KEY="megaflowz_recent_colors",c.MAX_RECENT=8,c.PRESETS=["#ef4444","#f97316","#eab308","#22c55e","#10b981","#3b82f6","#8b5cf6","#ec4899","#00d394","#ff4d6b","#3a86ff","#ffffff","#94a3b8","#475569","#1e293b","#000000"];let p=c;export{p as ColorPicker};
