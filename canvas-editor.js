/**
 * Canvas富文本编辑器 - Web Component实现
 * 使用Canvas进行渲染控制，避免浏览器换行问题
 */
class CanvasEditor extends HTMLElement {
  // 组件定义
  #componentDefinitions;
  #canvas;
  #ctx;
  #content = [];
  #cursor = { x: 5, y: 20, visible: true };
  #selection = null;
  #activeComponent = null;
  #scale = window.devicePixelRatio || 1;
  #scrollPosition = { x: 0, y: 0 };
  #textHeight = 20;
  #padding = 10;
  #lineSpacing = 8;
  #cursorBlinkInterval = null;

  constructor() {
    super();
    
    // 创建 Shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // 初始化组件定义
    this.#componentDefinitions = [
      {
        prefix: '{TLJ-PLLJ-',
        suffix: '}',
        type: 'tlj',
        color: '#ffdddd',
        borderColor: '#ff9999',
        textColor: '#d81e06',
        needsId: true,
        formatTitle: (id) => `淘礼金: ${id}`,
      },
      {
        prefix: '{JDLJ-PLLJ-',
        suffix: '}',
        type: 'jdlj',
        color: '#ffeeee',
        borderColor: '#ff8888',
        textColor: '#e1251b',
        needsId: true,
        formatTitle: (id) => `京东礼金: ${id}`,
      },
      {
        prefix: '{@昵称',
        suffix: '}',
        type: 'nickname',
        color: '#e5f0ff',
        borderColor: '#99ccff',
        textColor: '#006eff',
        needsId: false,
        formatTitle: () => '昵称占位符',
      },
      {
        prefix: '[',
        suffix: ']',
        type: 'emoji',
        color: '#fff6e5',
        borderColor: '#ffd591',
        textColor: '#ff9500',
        needsId: true,
        formatTitle: (id) => `表情: ${id}`,
      }
    ];
  }
  
  /**
   * 连接到DOM时调用
   * 准备DOM结构、设置事件监听器等
   */
  connectedCallback() {
    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        min-height: 300px;
      }
      
      .editor-container {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 300px;
        border: 1px solid #ccc;
        border-radius: 5px;
      }
      
      .canvas-container {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 300px;
        overflow: auto;
        background-color: white;
      }
      
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        cursor: text;
      }
      
      .toolbar {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      
      button {
        padding: 5px 10px;
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
      }
      
      button:hover {
        background: #e0e0e0;
      }
      
      .hidden-input {
        position: absolute;
        left: -9999px;
        top: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
      }
      
      .status-bar {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #666;
        padding: 5px;
        border-top: 1px solid #eee;
        margin-top: 5px;
      }
    `;
    
    // 创建HTML结构
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="toolbar">
        <button data-type="tlj">插入淘礼金</button>
        <button data-type="jdlj">插入京东礼金</button>
        <button data-type="nickname">插入昵称</button>
        <button data-type="emoji">插入表情</button>
        <button data-action="plaintext">获取文本</button>
        <button data-action="save">保存内容</button>
        <button data-action="load">加载内容</button>
        <button data-action="example">示例内容</button>
      </div>
      <div class="editor-container">
        <div class="canvas-container">
          <canvas></canvas>
        </div>
        <textarea class="hidden-input" aria-hidden="true"></textarea>
      </div>
      <div class="status-bar">
        <span class="cursor-position">光标：第1行 第0列</span>
        <span class="component-count">组件：0个</span>
      </div>
    `;
    
    // 添加到 Shadow DOM
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);
    
    // 获取Canvas和隐藏输入框
    this.#canvas = this.shadowRoot.querySelector('canvas');
    this.#ctx = this.#canvas.getContext('2d');
    this.hiddenInput = this.shadowRoot.querySelector('.hidden-input');
    
    // 设置Canvas尺寸
    this._resizeCanvas();
    
    // 设置事件监听
    this._setupEvents();
    
    // 开始光标闪烁
    this._startCursorBlink();
    
    // 初始渲染
    this._render();
    
    // 分发组件准备好的事件
    this.dispatchEvent(new CustomEvent('editor-ready', { 
      bubbles: true,
      composed: true
    }));
  }
  
  /**
   * 设置Canvas尺寸，考虑设备像素比
   */
  _resizeCanvas() {
    const container = this.shadowRoot.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();
    
    const width = rect.width;
    const height = rect.height;
    
    // 设置Canvas元素的尺寸
    this.#canvas.width = width * this.#scale;
    this.#canvas.height = height * this.#scale;
    
    // 调整Canvas的CSS尺寸
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    
    // 调整渲染环境以匹配设备像素比
    this.#ctx.scale(this.#scale, this.#scale);
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 设置事件监听
   */
  _setupEvents() {
    // 窗口调整大小时重设Canvas尺寸
    window.addEventListener('resize', () => {
      this._resizeCanvas();
    });
    
    // 设置工具栏按钮点击监听
    this.shadowRoot.querySelector('.toolbar').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      
      if (button.dataset.type) {
        // 插入组件
        this._insertComponent(button.dataset.type);
      } else if (button.dataset.action) {
        // 执行操作
        switch (button.dataset.action) {
          case 'plaintext':
            this._showPlainText();
            break;
          case 'save':
            this._saveContent();
            break;
          case 'load':
            this._loadContent();
            break;
          case 'example':
            this._loadExample();
            break;
        }
      }
    });
    
    // Canvas点击事件 - 移动光标
    this.#canvas.addEventListener('click', (event) => {
      const rect = this.#canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * this.#scale;
      const y = (event.clientY - rect.top) * this.#scale;
      
      this._handleCanvasClick(x / this.#scale, y / this.#scale);
    });
    
    // 隐藏输入框的输入事件
    this.hiddenInput.addEventListener('input', (event) => {
      this._handleTextInput(event.target.value);
      // 清空输入框，为下一次输入做准备
      event.target.value = '';
    });
    
    // 键盘事件 - 处理特殊键
    this.#canvas.addEventListener('keydown', (event) => {
      this._handleKeyDown(event);
    });
    
    // 确保Canvas可获得焦点
    this.#canvas.setAttribute('tabindex', '0');
    
    // 获得焦点时让隐藏输入框获得焦点
    this.#canvas.addEventListener('focus', () => {
      setTimeout(() => {
        this.hiddenInput.focus();
      }, 10);
    });
    
    // 粘贴事件
    this.#canvas.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      this._handleTextInput(text, true);
    });
  }
  
  /**
   * 开始光标闪烁
   */
  _startCursorBlink() {
    if (this.#cursorBlinkInterval) {
      clearInterval(this.#cursorBlinkInterval);
    }
    
    this.#cursorBlinkInterval = setInterval(() => {
      this.#cursor.visible = !this.#cursor.visible;
      this._render();
    }, 500);
  }
  
  /**
   * 处理Canvas点击
   */
  _handleCanvasClick(x, y) {
    // 重置光标闪烁
    this.#cursor.visible = true;
    clearInterval(this.#cursorBlinkInterval);
    this._startCursorBlink();
    
    // 检测点击的是否是组件
    const component = this._findComponentAt(x, y);
    if (component) {
      // 选中组件
      this.#activeComponent = component;
      this.#cursor.x = component.x + component.width + 2;
      this.#cursor.y = component.y + component.height / 2;
    } else {
      // 计算最近的光标位置
      this.#activeComponent = null;
      const position = this._calculateCursorPosition(x, y);
      this.#cursor.x = position.x;
      this.#cursor.y = position.y;
    }
    
    // 更新状态栏
    this._updateStatusBar();
    
    // 确保隐藏输入框获得焦点
    this.hiddenInput.focus();
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 查找指定坐标处的组件
   */
  _findComponentAt(x, y) {
    for (const item of this.#content) {
      if (item.type === 'component' && 
          x >= item.x && x <= item.x + item.width &&
          y >= item.y - item.height/2 && y <= item.y + item.height/2) {
        return item;
      }
    }
    return null;
  }
  
  /**
   * 计算给定坐标最近的光标位置
   */
  _calculateCursorPosition(x, y) {
    // 如果内容为空，返回初始位置
    if (this.#content.length === 0) {
      return { x: this.#padding, y: this.#padding + this.#textHeight };
    }
    
    // 找到最近的行
    let nearestLine = null;
    let minDistance = Number.MAX_VALUE;
    
    // 按行组织内容
    const lines = this._organizeContentByLines();
    
    for (const line of lines) {
      const distance = Math.abs(line.y - y);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLine = line;
      }
    }
    
    if (!nearestLine || nearestLine.items.length === 0) {
      return { x: this.#padding, y: this.#padding + this.#textHeight };
    }
    
    // 在行中找到最接近x坐标的位置
    let cursorX = this.#padding;
    let foundPosition = false;
    
    for (const item of nearestLine.items) {
      const itemMiddle = item.x + item.width / 2;
      
      if (x < itemMiddle) {
        cursorX = item.x;
        foundPosition = true;
        break;
      } else {
        cursorX = item.x + item.width;
      }
    }
    
    if (!foundPosition && nearestLine.items.length > 0) {
      const lastItem = nearestLine.items[nearestLine.items.length - 1];
      cursorX = lastItem.x + lastItem.width;
    }
    
    return { x: cursorX, y: nearestLine.y };
  }
  
  /**
   * 按行组织内容
   */
  _organizeContentByLines() {
    const lines = [];
    let currentY = null;
    let currentLine = null;
    
    for (const item of this.#content) {
      if (currentY === null || Math.abs(item.y - currentY) > 5) {
        currentY = item.y;
        currentLine = { y: currentY, items: [] };
        lines.push(currentLine);
      }
      
      currentLine.items.push(item);
    }
    
    // 按行内x坐标排序
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
    }
    
    return lines;
  }
  
  /**
   * 处理文本输入
   */
  _handleTextInput(text, isPaste = false) {
    if (!text) return;
    
    // 检查是否有组件标记
    const componentMatch = this._checkForComponentMark(text);
    if (componentMatch) {
      // 如果是组件标记，添加组件
      const { type, id } = componentMatch;
      this._insertComponentItem(type, id);
    } else {
      // 否则添加普通文本
      const textItem = {
        type: 'text',
        text,
        x: this.#cursor.x,
        y: this.#cursor.y,
        width: this._measureText(text).width,
        height: this.#textHeight
      };
      
      this.#content.push(textItem);
      
      // 更新光标位置
      this.#cursor.x += textItem.width;
    }
    
    // 检查是否需要重排内容（例如当接近画布边缘时）
    this._reflowContent();
    
    // 更新状态栏
    this._updateStatusBar();
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 检查文本是否包含组件标记
   */
  _checkForComponentMark(text) {
    for (const def of this.#componentDefinitions) {
      // 构建正则表达式模式
      const pattern = `${this._escapeRegExp(def.prefix)}([^${this._escapeRegExp(def.suffix)}]*)${this._escapeRegExp(def.suffix)}`;
      const regex = new RegExp(pattern);
      
      const match = text.match(regex);
      if (match) {
        return {
          type: def.type,
          id: match[1] || '' // 组件ID
        };
      }
    }
    
    return null;
  }
  
  /**
   * 插入组件
   */
  _insertComponent(type) {
    const def = this.#componentDefinitions.find(d => d.type === type);
    if (!def) return;
    
    let id = '';
    if (def.needsId) {
      id = prompt(`请输入${def.formatTitle('')}的ID:`);
      if (id === null || id === '') return;
    }
    
    this._insertComponentItem(type, id);
    this._reflowContent();
    this._render();
  }
  
  /**
   * 插入组件项
   */
  _insertComponentItem(type, id) {
    const def = this.#componentDefinitions.find(d => d.type === type);
    if (!def) return;
    
    // 生成显示文本
    const displayText = def.formatTitle(id);
    
    // 计算组件宽度
    const textWidth = this._measureText(displayText).width;
    const padding = 10; // 组件内边距
    const width = textWidth + padding * 2;
    
    // 创建组件项
    const component = {
      type: 'component',
      componentType: type,
      id,
      displayText,
      x: this.#cursor.x,
      y: this.#cursor.y,
      width,
      height: this.#textHeight + 6,
      color: def.color,
      borderColor: def.borderColor,
      textColor: def.textColor,
      serialized: def.needsId 
        ? `${def.prefix}${id}${def.suffix}`
        : `${def.prefix}${def.suffix}`
    };
    
    // 添加到内容
    this.#content.push(component);
    
    // 更新光标位置
    this.#cursor.x = component.x + component.width + 2;
    
    // 添加空格
    const spaceWidth = this._measureText(' ').width;
    this.#content.push({
      type: 'text',
      text: ' ',
      x: this.#cursor.x,
      y: this.#cursor.y,
      width: spaceWidth,
      height: this.#textHeight
    });
    
    // 更新光标位置
    this.#cursor.x += spaceWidth;
    
    // 更新状态栏
    this._updateStatusBar();
  }
  
  /**
   * 测量文本宽度
   */
  _measureText(text) {
    return this.#ctx.measureText(text);
  }
  
  /**
   * 重排内容
   * 简单实现：当接近右边缘时换行
   */
  _reflowContent() {
    const containerWidth = this.#canvas.width / this.#scale - this.#padding * 2;
    
    let currentX = this.#padding;
    let currentY = this.#padding + this.#textHeight;
    let lineHeight = this.#textHeight;
    
    // 按照顺序排列内容
    for (const item of this.#content) {
      // 检查是否需要换行
      if (currentX + item.width > containerWidth) {
        currentX = this.#padding;
        currentY += lineHeight + this.#lineSpacing;
      }
      
      // 更新项位置
      item.x = currentX;
      item.y = currentY;
      
      // 更新最大行高
      if (item.height > lineHeight) {
        lineHeight = item.height;
      }
      
      // 移动到下一个位置
      currentX += item.width;
    }
    
    // 如果光标超出画布宽度，换行
    if (this.#cursor.x > containerWidth) {
      this.#cursor.x = this.#padding;
      this.#cursor.y = currentY + lineHeight + this.#lineSpacing;
    } else {
      // 否则确保光标在当前行上
      this.#cursor.y = currentY;
    }
  }
  
  /**
   * 处理键盘事件
   */
  _handleKeyDown(event) {
    // 避免处理组合键
    if (event.ctrlKey || event.metaKey) {
      // 但处理复制粘贴
      if (event.key === 'c') {
        this._handleCopy(event);
      }
      return;
    }
    
    switch (event.key) {
      case 'Backspace':
        this._handleBackspace();
        break;
      case 'Delete':
        this._handleDelete();
        break;
      case 'ArrowLeft':
        this._moveCursor(-1, 0);
        break;
      case 'ArrowRight':
        this._moveCursor(1, 0);
        break;
      case 'ArrowUp':
        this._moveCursor(0, -1);
        break;
      case 'ArrowDown':
        this._moveCursor(0, 1);
        break;
      case 'Enter':
        this._handleEnter();
        break;
      case 'Tab':
        event.preventDefault();
        this._handleTab();
        break;
    }
  }
  
  /**
   * 处理复制操作
   */
  _handleCopy(event) {
    if (this.#activeComponent) {
      // 复制组件的序列化表示
      event.clipboardData.setData('text/plain', this.#activeComponent.serialized);
      event.preventDefault();
    }
  }
  
  /**
   * 处理退格键
   */
  _handleBackspace() {
    // 如果有选中的组件，删除它
    if (this.#activeComponent) {
      this.#content = this.#content.filter(item => item !== this.#activeComponent);
      this.#cursor.x = this.#activeComponent.x;
      this.#activeComponent = null;
    } else {
      // 找到光标左侧的内容
      const item = this._findItemBeforeCursor();
      if (item) {
        // 如果是文本，可以删除最后一个字符
        if (item.type === 'text' && item.text.length > 0) {
          item.text = item.text.slice(0, -1);
          item.width = this._measureText(item.text).width;
          
          // 如果文本为空，删除此项
          if (item.text.length === 0) {
            this.#content = this.#content.filter(i => i !== item);
          }
        } else {
          // 否则删除整个项
          this.#content = this.#content.filter(i => i !== item);
        }
        
        // 更新光标位置
        if (item.type === 'text' && item.text.length > 0) {
          this.#cursor.x = item.x + item.width;
        } else {
          this.#cursor.x = item.x;
        }
      }
    }
    
    // 重新排列内容
    this._reflowContent();
    
    // 更新状态栏
    this._updateStatusBar();
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 处理Delete键
   */
  _handleDelete() {
    // 找到光标右侧的内容
    const item = this._findItemAfterCursor();
    if (item) {
      this.#content = this.#content.filter(i => i !== item);
      
      // 重新排列内容
      this._reflowContent();
      
      // 更新状态栏
      this._updateStatusBar();
      
      // 重新渲染
      this._render();
    }
  }
  
  /**
   * 处理回车键
   */
  _handleEnter() {
    const lineHeight = this.#textHeight + this.#lineSpacing;
    this.#cursor.x = this.#padding;
    this.#cursor.y += lineHeight;
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 处理Tab键
   */
  _handleTab() {
    const tabWidth = this._measureText('    ').width;
    this.#cursor.x += tabWidth;
    
    // 如果需要，可以添加一个Tab文本项
    this.#content.push({
      type: 'text',
      text: '    ',
      x: this.#cursor.x - tabWidth,
      y: this.#cursor.y,
      width: tabWidth,
      height: this.#textHeight
    });
    
    // 重新排列内容
    this._reflowContent();
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 移动光标
   */
  _moveCursor(deltaX, deltaY) {
    if (deltaX !== 0) {
      // 水平移动
      const lines = this._organizeContentByLines();
      const currentLine = lines.find(line => Math.abs(line.y - this.#cursor.y) < 5);
      
      if (currentLine) {
        let items = currentLine.items;
        
        if (deltaX < 0) {
          // 向左移动
          // 找到光标左侧的项目
          let newPosition = { x: this.#padding, y: this.#cursor.y };
          
          for (const item of items) {
            if (item.x + item.width < this.#cursor.x) {
              newPosition.x = item.x + item.width;
            }
          }
          
          if (newPosition.x === this.#padding && this.#cursor.x === this.#padding) {
            // 如果已经在行首，尝试移到上一行末尾
            const lineIndex = lines.indexOf(currentLine);
            if (lineIndex > 0) {
              const prevLine = lines[lineIndex - 1];
              if (prevLine.items.length > 0) {
                const lastItem = prevLine.items[prevLine.items.length - 1];
                newPosition.x = lastItem.x + lastItem.width;
                newPosition.y = prevLine.y;
              } else {
                newPosition.y = prevLine.y;
              }
            }
          }
          
          this.#cursor.x = newPosition.x;
          this.#cursor.y = newPosition.y;
        } else {
          // 向右移动
          // 找到光标右侧的项目
          let found = false;
          
          for (const item of items) {
            if (item.x > this.#cursor.x) {
              this.#cursor.x = item.x + item.width;
              found = true;
              break;
            }
          }
          
          if (!found) {
            // 如果没有找到，尝试移到下一行行首
            const lineIndex = lines.indexOf(currentLine);
            if (lineIndex < lines.length - 1) {
              this.#cursor.x = this.#padding;
              this.#cursor.y = lines[lineIndex + 1].y;
            }
          }
        }
      }
    }
    
    if (deltaY !== 0) {
      // 垂直移动
      const lines = this._organizeContentByLines();
      const currentLineIndex = lines.findIndex(line => Math.abs(line.y - this.#cursor.y) < 5);
      
      if (currentLineIndex >= 0) {
        let targetLineIndex = currentLineIndex + deltaY;
        targetLineIndex = Math.max(0, Math.min(targetLineIndex, lines.length - 1));
        
        if (targetLineIndex !== currentLineIndex) {
          const currentX = this.#cursor.x;
          this.#cursor.y = lines[targetLineIndex].y;
          
          // 尝试保持相同的水平位置
          let closestItem = null;
          let minDistance = Number.MAX_VALUE;
          
          for (const item of lines[targetLineIndex].items) {
            const distance = Math.abs(item.x - currentX);
            if (distance < minDistance) {
              minDistance = distance;
              closestItem = item;
            }
          }
          
          if (closestItem) {
            if (currentX < closestItem.x) {
              this.#cursor.x = closestItem.x;
            } else if (currentX > closestItem.x + closestItem.width) {
              this.#cursor.x = closestItem.x + closestItem.width;
            } else {
              this.#cursor.x = currentX;
            }
          } else {
            this.#cursor.x = this.#padding;
          }
        }
      }
    }
     
    // 更新状态栏
    this._updateStatusBar();
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 查找光标前的项目
   */
  _findItemBeforeCursor() {
    // 按行组织内容
    const lines = this._organizeContentByLines();
    const currentLine = lines.find(line => Math.abs(line.y - this.#cursor.y) < 5);
    
    if (!currentLine) return null;
    
    // 找到光标左侧最近的项目
    let closestItem = null;
    let maxX = -Infinity;
    
    for (const item of currentLine.items) {
      if (item.x + item.width <= this.#cursor.x && item.x + item.width > maxX) {
        closestItem = item;
        maxX = item.x + item.width;
      }
    }
    
    return closestItem;
  }
  
  /**
   * 查找光标后的项目
   */
  _findItemAfterCursor() {
    // 按行组织内容
    const lines = this._organizeContentByLines();
    const currentLine = lines.find(line => Math.abs(line.y - this.#cursor.y) < 5);
    
    if (!currentLine) return null;
    
    // 找到光标右侧最近的项目
    let closestItem = null;
    let minX = Infinity;
    
    for (const item of currentLine.items) {
      if (item.x >= this.#cursor.x && item.x < minX) {
        closestItem = item;
        minX = item.x;
      }
    }
    
    return closestItem;
  }
  
  /**
   * 更新状态栏信息
   */
  _updateStatusBar() {
    // 计算当前行号和列号
    const lines = this._organizeContentByLines();
    let lineNumber = 1;
    let columnNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (Math.abs(line.y - this.#cursor.y) < 5) {
        lineNumber = i + 1;
        
        // 计算列号
        for (const item of line.items) {
          if (item.x < this.#cursor.x) {
            if (item.type === 'text') {
              columnNumber += item.text.length;
            } else {
              columnNumber += 1; // 组件算作一个字符
            }
          }
        }
        
        break;
      }
    }
    
    // 计算组件数量
    const componentCount = this.#content.filter(item => item.type === 'component').length;
    
    // 更新状态栏
    const cursorPositionElem = this.shadowRoot.querySelector('.cursor-position');
    const componentCountElem = this.shadowRoot.querySelector('.component-count');
    
    if (cursorPositionElem) {
      cursorPositionElem.textContent = `光标：第${lineNumber}行 第${columnNumber}列`;
    }
    
    if (componentCountElem) {
      componentCountElem.textContent = `组件：${componentCount}个`;
    }
  }
  
  /**
   * 渲染编辑器内容
   */
  _render() {
    const ctx = this.#ctx;
    const width = this.#canvas.width / this.#scale;
    const height = this.#canvas.height / this.#scale;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置字体
    ctx.font = `${this.#textHeight}px Arial`;
    ctx.textBaseline = 'middle';
    
    // 渲染内容
    for (const item of this.#content) {
      if (item.type === 'text') {
        ctx.fillStyle = '#000000';
        ctx.fillText(item.text, item.x, item.y);
      } else if (item.type === 'component') {
        // 绘制组件背景
        ctx.fillStyle = item.color || '#e0f0ff';
        ctx.strokeStyle = item.borderColor || '#a0c0ff';
        ctx.lineWidth = 1;
        
        const padding = 5;
        const height = item.height;
        const y = item.y - height / 2;
        
        // 绘制圆角矩形
        this._drawRoundedRect(
          ctx, 
          item.x - padding, 
          y, 
          item.width + padding * 2, 
          height, 
          3
        );
        
        ctx.fill();
        ctx.stroke();
        
        // 绘制组件文本
        ctx.fillStyle = item.textColor || '#000000';
        ctx.fillText(item.displayText, item.x, item.y);
        
        // 如果是活动组件，添加选中效果
        if (item === this.#activeComponent) {
          ctx.strokeStyle = '#0066cc';
          ctx.lineWidth = 2;
          this._drawRoundedRect(
            ctx, 
            item.x - padding - 2, 
            y - 2, 
            item.width + padding * 2 + 4, 
            height + 4, 
            3
          );
          ctx.stroke();
        }
      }
    }
    
    // 绘制光标
    if (this.#cursor.visible) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.#cursor.x, this.#cursor.y - this.#textHeight / 2);
      ctx.lineTo(this.#cursor.x, this.#cursor.y + this.#textHeight / 2);
      ctx.stroke();
    }
  }
  
  /**
   * 辅助方法：绘制圆角矩形
   */
  _drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  
  /**
   * 辅助方法：转义正则表达式特殊字符
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 保存内容
   */
  _saveContent() {
    try {
      localStorage.setItem('canvas-editor-content', JSON.stringify(this.#content));
      localStorage.setItem('canvas-editor-cursor', JSON.stringify({
        x: this.#cursor.x,
        y: this.#cursor.y
      }));
      alert('内容已保存！');
    } catch (e) {
      alert('保存失败：' + e.message);
    }
  }
  
  /**
   * 加载内容
   */
  _loadContent() {
    try {
      const savedContent = localStorage.getItem('canvas-editor-content');
      const savedCursor = localStorage.getItem('canvas-editor-cursor');
      
      if (!savedContent) {
        alert('没有找到保存的内容！');
        return;
      }
      
      this.#content = JSON.parse(savedContent);
      
      if (savedCursor) {
        const cursor = JSON.parse(savedCursor);
        this.#cursor.x = cursor.x;
        this.#cursor.y = cursor.y;
      }
      
      // 更新状态栏
      this._updateStatusBar();
      
      // 重新渲染
      this._render();
      
      alert('内容已加载！');
    } catch (e) {
      alert('加载失败：' + e.message);
    }
  }
  
  /**
   * 加载示例内容
   */
  _loadExample() {
    // 清空当前内容
    this.#content = [];
    
    // 重置光标
    this.#cursor.x = this.#padding;
    this.#cursor.y = this.#padding + this.#textHeight;
    
    // 添加标题文本
    const titleText = '示例文档 - 组件演示';
    const titleWidth = this.#ctx.measureText(titleText).width;
    
    this.#content.push({
      type: 'text',
      text: titleText,
      x: this.#padding,
      y: this.#cursor.y,
      width: titleWidth,
      height: this.#textHeight
    });
    
    // 移动到下一行
    this.#cursor.y += this.#textHeight + this.#lineSpacing;
    
    // 添加描述文本
    const descText = '这是一个包含多种组件的示例文档：';
    const descWidth = this.#ctx.measureText(descText).width;
    
    this.#content.push({
      type: 'text',
      text: descText,
      x: this.#padding,
      y: this.#cursor.y,
      width: descWidth,
      height: this.#textHeight
    });
    
    // 移动到下一行
    this.#cursor.y += this.#textHeight + this.#lineSpacing;
    
    // 添加文本和淘礼金组件
    const text1 = '您可以查看这个';
    const text1Width = this.#ctx.measureText(text1).width;
    
    this.#content.push({
      type: 'text',
      text: text1,
      x: this.#padding,
      y: this.#cursor.y,
      width: text1Width,
      height: this.#textHeight
    });
    
    // 更新光标位置
    this.#cursor.x = this.#padding + text1Width;
    
    // 添加淘礼金组件
    this._insertComponentItem('tlj', '123456');
    
    // 添加文本
    const text2 = '然后继续输入文字并插入';
    const text2Width = this.#ctx.measureText(text2).width;
    
    this.#content.push({
      type: 'text',
      text: text2,
      x: this.#cursor.x,
      y: this.#cursor.y,
      width: text2Width,
      height: this.#textHeight
    });
    
    // 更新光标位置
    this.#cursor.x += text2Width;
    
    // 添加昵称组件
    this._insertComponentItem('nickname', '');
    
    // 移动到下一行
    this.#cursor.x = this.#padding;
    this.#cursor.y += this.#textHeight + this.#lineSpacing;
    
    // 添加文本和表情组件
    const text3 = '这里还可以插入表情：';
    const text3Width = this.#ctx.measureText(text3).width;
    
    this.#content.push({
      type: 'text',
      text: text3,
      x: this.#cursor.x,
      y: this.#cursor.y,
      width: text3Width,
      height: this.#textHeight
    });
    
    // 更新光标位置
    this.#cursor.x += text3Width;
    
    // 添加表情组件
    this._insertComponentItem('emoji', '笑脸');
    
    // 重排内容
    this._reflowContent();
    
    // 更新状态栏
    this._updateStatusBar();
    
    // 重新渲染
    this._render();
  }
  
  /**
   * 显示纯文本内容
   */
  _showPlainText() {
    const plainText = this.getPlainText();
    alert('纯文本内容：\n\n' + plainText);
    
    // 尝试复制到剪贴板
    navigator.clipboard.writeText(plainText).then(() => {
      console.log('纯文本已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败：', err);
    });
  }
  
  /**
   * 获取纯文本内容
   */
  getPlainText() {
    let plainText = '';
    let lastY = null;
    
    // 按行组织内容
    const lines = this._organizeContentByLines();
    
    // 遍历每一行内容
    for (const line of lines) {
      for (const item of line.items) {
        if (item.type === 'text') {
          plainText += item.text;
        } else if (item.type === 'component') {
          plainText += item.serialized;
        }
      }
      plainText += '\n'; // 每行末尾添加换行符
    }
    
    return plainText.trim();
  }
  
  /**
   * 断开连接时清理
   */
  disconnectedCallback() {
    // 停止光标闪烁
    if (this.#cursorBlinkInterval) {
      clearInterval(this.#cursorBlinkInterval);
    }
    
    // 移除事件监听器
    window.removeEventListener('resize', this._resizeCanvas);
  }
}

// 注册自定义元素
customElements.define('canvas-editor', CanvasEditor);
