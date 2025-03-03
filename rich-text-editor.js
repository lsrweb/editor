/**
 * 富文本组件编辑器 - Web Component 实现
 */
class RichTextEditor extends HTMLElement {
  // 组件定义
  #componentDefinitions;
  #editor;
  
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
        className: 'component tlj-component',
        needsId: true,
        formatTitle: (id) => `淘礼金组件: ${id}`,
      },
      {
        prefix: '{JDLJ-PLLJ-',
        suffix: '}',
        type: 'jdlj',
        className: 'component jdlj-component',
        needsId: true,
        formatTitle: (id) => `京东礼金组件: ${id}`,
      },
      {
        prefix: '{@昵称',
        suffix: '}',
        type: 'nickname',
        className: 'component nickname-component',
        needsId: false,
        formatTitle: () => '昵称占位符',
      },
      {
        prefix: '[',
        suffix: ']',
        type: 'emoji',
        className: 'component emoji-component',
        needsId: true,
        formatTitle: (id) => `表情: ${id}`,
        noWrap: true
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
      }
      
      .editor-container {
        border: 1px solid #ccc;
        min-height: 200px;
        padding: 10px;
        margin: 10px 0;
        border-radius: 4px;
      }
      
      .toolbar {
        display: flex;
        gap: 5px;
        margin-bottom: 10px;
      }
      
      button {
        padding: 5px 10px;
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
      }
      
      button:hover {
        background: #e0e0e0;
      }
      
      .component {
        background-color: #e0f0ff;
        border: 1px solid #a0c0ff;
        padding: 2px 5px;
        border-radius: 3px;
        margin: 0 2px;
        user-select: all;
        display: inline-block;
      }
      
      .tlj-component {
        color: #d81e06;
        background-color: rgba(255, 235, 235, 0.7);
        border: 1px dashed #ffb8b8;
      }
      
      .jdlj-component {
        color: #e1251b;
        background-color: rgba(255, 235, 235, 0.7);
        border: 1px dashed #ff9797;
      }
      
      .nickname-component {
        color: #006eff;
        background-color: rgba(235, 245, 255, 0.7);
        border: 1px dashed #b8dcff;
      }
      
      .emoji-component {
        color: #ff9500;
        background-color: rgba(255, 248, 235, 0.7);
        border: 1px dashed #ffd591;
      }
      
      .component:hover {
        background-color: rgba(0, 0, 0, 0.05);
        outline: 1px solid rgba(0, 0, 0, 0.2);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
      </div>
      <div class="editor-container" contenteditable="true"></div>
      <div class="actions">
        <button id="save">保存内容</button>
        <button id="load">回显测试</button>
        <button id="example">加载示例</button>
        <button id="plaintext">显示纯文本</button>
      </div>
    `;
    
    // 添加到 Shadow DOM
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);
    
    // 保存对编辑器的引用
    this.#editor = this.shadowRoot.querySelector('.editor-container');
    
    // 设置事件监听
    this._setupEvents();
    
    // 分发组件准备好的事件
    this.dispatchEvent(new CustomEvent('editor-ready', { 
      bubbles: true,
      composed: true
    }));
  }
  
  /**
   * 设置事件监听
   */
  _setupEvents() {
    // 设置工具栏按钮点击监听
    const toolbar = this.shadowRoot.querySelector('.toolbar');
    toolbar.addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON') {
        const type = event.target.dataset.type;
        if (type) {
          this.insertComponent(type);
        }
      }
    });
    
    // 设置操作按钮监听
    const saveButton = this.shadowRoot.querySelector('#save');
    saveButton.addEventListener('click', () => this.saveContent());
    
    const loadButton = this.shadowRoot.querySelector('#load');
    loadButton.addEventListener('click', () => this.loadContent());
    
    const exampleButton = this.shadowRoot.querySelector('#example');
    exampleButton.addEventListener('click', () => this.loadTestExample());
    
    const plaintextButton = this.shadowRoot.querySelector('#plaintext');
    plaintextButton.addEventListener('click', () => this.showPlainText());
    
    // 监听粘贴事件
    this.#editor.addEventListener('paste', this._handlePaste.bind(this));
    
    // 输入事件 - 检查是否插入了组件文本
    this.#editor.addEventListener('input', () => {
      // 检查组件文本并转换
      this._checkAndTransformComponents();
    });
    
    // 监听键盘事件，保护组件不被拆分
    this.#editor.addEventListener('keydown', this._handleKeyDown.bind(this));
  }
  
  /**
   * 处理键盘事件
   */
  _handleKeyDown(event) {
    // 检查删除键和退格键
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      
      // 查找删除操作是否会影响组件
      const components = this._findComponentsInRange(range);
      if (components.length > 0) {
        // 阻止默认删除
        event.preventDefault();
        
        // 手动删除整个组件
        components.forEach(component => component.remove());
      }
    }
  }
  
  /**
   * 查找范围内的组件
   */
  _findComponentsInRange(range) {
    const components = [];
    
    // 如果选区已折叠(即光标位置)
    if (range.collapsed) {
      // 向前检查
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        // 检查前面的组件
        if (range.startOffset === 0) {
          let prev = node.previousSibling;
          while (prev) {
            if (prev.classList && prev.classList.contains('component')) {
              components.push(prev);
              break;
            }
            prev = prev.previousSibling;
          }
        }
      }
    } else {
      // 检查非折叠选区
      const allComponents = this.#editor.querySelectorAll('.component');
      allComponents.forEach(component => {
        // 创建组件范围
        const compRange = document.createRange();
        compRange.selectNode(component);
        
        // 检查是否与选区重叠
        if (range.compareBoundaryPoints(Range.END_TO_START, compRange) <= 0 &&
            range.compareBoundaryPoints(Range.START_TO_END, compRange) >= 0) {
          components.push(component);
        }
      });
    }
    
    return components;
  }
  
  /**
   * 处理粘贴事件
   */
  _handlePaste(event) {
    // 阻止默认粘贴行为
    event.preventDefault();
    
    // 获取纯文本
    const text = (event.clipboardData || window.clipboardData).getData('text/plain');
    
    // 在当前选区处插入文本
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // 插入文本并设置光标
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 检查粘贴的文本中是否有组件标记
      this._checkAndTransformComponents();
    }
  }
  
  /**
   * 检查并转换文本中的组件
   */
  _checkAndTransformComponents() {
    this._processTextNodes(this.#editor);
    this._ensureComponentsNotEditable();
  }
  
  /**
   * 递归处理文本节点，检查组件标记
   */
  _processTextNodes(node) {
    if (!node) return;
    
    // 处理文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      let allMatches = [];
      
      // 查找所有组件标记
      for (const def of this.#componentDefinitions) {
        const pattern = new RegExp(
          this._escapeRegExp(def.prefix) +
          (def.needsId ? '([^' + this._escapeRegExp(def.suffix) + ']+)' : '') +
          this._escapeRegExp(def.suffix),
          'g'
        );
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
          allMatches.push({
            definition: def,
            match: match[0],
            content: def.needsId ? match[1] || '' : '',
            start: match.index,
            end: match.index + match[0].length
          });
        }
      }
      
      // 如果找到组件标记
      if (allMatches.length > 0) {
        allMatches.sort((a, b) => a.start - b.start);
        
        // 创建文档片段替换节点
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        
        for (const match of allMatches) {
          // 添加组件前的文本
          if (match.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
          }
          
          // 创建组件元素
          const component = this.createComponentElement(
            match.definition,
            match.content
          );
          fragment.appendChild(component);
          
          lastIndex = match.end;
        }
        
        // 添加剩余文本
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        
        // 替换原始节点
        node.parentNode.replaceChild(fragment, node);
      }
      
      return;
    }
    
    // 递归处理子节点
    if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('component')) {
      const children = Array.from(node.childNodes);
      children.forEach(child => this._processTextNodes(child));
    }
  }
  
  /**
   * 确保所有组件都不可编辑
   */
  _ensureComponentsNotEditable() {
    const components = this.#editor.querySelectorAll('.component');
    components.forEach(component => {
      component.contentEditable = 'false';
    });
  }
  
  /**
   * 辅助函数：转义正则表达式特殊字符
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 插入组件
   */
  insertComponent(type) {
    const componentDef = this.#componentDefinitions.find(c => c.type === type);
    if (!componentDef) return;
    
    // 确保编辑器获得焦点
    this.#editor.focus();
    
    // 检查选区是否在编辑器内
    if (!this._isSelectionInside()) {
      this._moveCursorToEnd();
    }
    
    // 获取组件ID
    let id = '';
    if (componentDef.needsId) {
      id = prompt(`请输入${componentDef.type}的ID:`);
      if (id === null) return;
    }
    
    // 创建并插入组件
    const component = this.createComponentElement(componentDef, id);
    this._insertAtCursor(component);

    // setSelectionRange
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStartAfter(component);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
  }
  
  /**
   * 创建组件元素
   */
  createComponentElement(componentDef, id) {
    const span = document.createElement('span');
    span.className = `component ${componentDef.className || ''}`;
    span.contentEditable = 'false';
    
    // 设置显示文本
    span.textContent = componentDef.formatTitle(id);
    
    // 存储原始数据
    span.dataset.type = componentDef.type;
    if (componentDef.needsId && id) {
      span.dataset.id = id;
    }
    
    // 存储序列化格式
    const serialized = componentDef.needsId 
      ? `${componentDef.prefix}${id}${componentDef.suffix}`
      : `${componentDef.prefix}${componentDef.suffix}`;
    span.dataset.serialized = serialized;
    
    return span;
  }
  
  /**
   * 辅助函数：判断选区是否在编辑器内
   */
  _isSelectionInside() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return false;
    
    const range = selection.getRangeAt(0);
    return this.#editor.contains(range.commonAncestorContainer);
  }
  
  /**
   * 辅助函数：移动光标到编辑器末尾
   */
  _moveCursorToEnd() {
    if (this.#editor.childNodes.length === 0) {
      this.#editor.appendChild(document.createElement('br'));
    }
    
    const range = document.createRange();
    range.selectNodeContents(this.#editor);
    range.collapse(false);
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  
  /**
   * 在光标位置插入节点
   */
  _insertAtCursor(node) {
    const selection = window.getSelection();
    
    if (selection.rangeCount === 0) {
      this._moveCursorToEnd();
    }
    
    let range = selection.getRangeAt(0);
    if (!this.#editor.contains(range.commonAncestorContainer)) {
      this._moveCursorToEnd();
      range = selection.getRangeAt(0);
    }
    
    // 插入组件
    range.deleteContents();
    range.insertNode(node);
    
    // 插入不间断空格
    const space = document.createTextNode('\u00A0');
    const spaceRange = document.createRange();
    spaceRange.setStartAfter(node);
    spaceRange.collapse(true);
    spaceRange.insertNode(space);
    
    // 移动光标到空格后
    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
  
  /**
   * 保存内容到本地存储
   */
  saveContent() {
    localStorage.setItem('editorContent', this.#editor.innerHTML);
    localStorage.setItem('editorContentSerialized', this.getSerializedContent());
    alert('内容已保存！');
  }
  
  /**
   * 从本地存储加载内容
   */
  loadContent() {
    const content = localStorage.getItem('editorContent');
    if (!content) {
      alert('没有找到保存的内容！');
      return;
    }
    
    this.#editor.innerHTML = content;
    this._ensureComponentsNotEditable();
    alert('内容已加载！');
  }
  
  /**
   * 加载测试示例
   */
  loadTestExample() {
    // 清空编辑器
    this.#editor.innerHTML = '';
    
    // 创建示例内容
    const p1 = document.createElement('p');
    p1.textContent = '这是一个测试示例，包含多种组件：';
    this.#editor.appendChild(p1);
    
    // 创建段落并添加组件
    const p2 = document.createElement('p');
    p2.textContent = '您可以查看这个';
    
    // 插入淘礼金组件
    const tlj = this.createComponentElement(
      this.#componentDefinitions.find(c => c.type === 'tlj'),
      '123456'
    );
    p2.appendChild(tlj);
    p2.appendChild(document.createTextNode('\u00A0并在这里插入'));
    
    // 插入昵称组件
    const nickname = this.createComponentElement(
      this.#componentDefinitions.find(c => c.type === 'nickname'),
      ''
    );
    p2.appendChild(nickname);
    p2.appendChild(document.createTextNode('\u00A0占位符，还可以添加'));
    
    // 插入表情组件
    const emoji = this.createComponentElement(
      this.#componentDefinitions.find(c => c.type === 'emoji'),
      '笑脸'
    );
    p2.appendChild(emoji);
    
    this.#editor.appendChild(p2);
    
    // 添加说明
    const p3 = document.createElement('p');
    p3.textContent = '试试在这些组件之间编辑文本，或添加新的组件！';
    this.#editor.appendChild(p3);
    
    alert('测试示例已加载！');
  }
  
  /**
   * 获取序列化内容
   */
  getSerializedContent() {
    const cloned = this.#editor.cloneNode(true);
    
    // 找到所有组件并替换为序列化格式
    const components = cloned.querySelectorAll('.component');
    components.forEach(component => {
      if (component.dataset.serialized) {
        const textNode = document.createTextNode(component.dataset.serialized);
        component.parentNode.replaceChild(textNode, component);
      }
    });
    
    return cloned.innerHTML;
  }
  
  /**
   * 获取纯文本内容
   */
  getPlainText() {
    const cloned = this.#editor.cloneNode(true);
    
    // 替换组件为序列化格式
    const components = cloned.querySelectorAll('.component');
    components.forEach(component => {
      if (component.dataset.serialized) {
        const textNode = document.createTextNode(component.dataset.serialized);
        component.parentNode.replaceChild(textNode, component);
      }
    });
    
    // 将HTML转换为纯文本
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cloned.innerHTML;
    
    // 处理段落和换行
    const paragraphs = tempDiv.querySelectorAll('p, div, br');
    paragraphs.forEach(p => {
      if (p.tagName === 'BR') {
        p.parentNode.replaceChild(document.createTextNode('\n'), p);
      } else {
        p.insertAdjacentHTML('afterend', '\n');
      }
    });
    
    return tempDiv.textContent.trim();
  }
  
  /**
   * 显示纯文本内容
   */
  showPlainText() {
    const plainText = this.getPlainText();
    alert('纯文本内容（用于传给后端）:\n\n' + plainText);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(plainText).then(() => {
      console.log('纯文本已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
    });
  }
  
  /**
   * 公共API：设置内容
   */
  setContent(content) {
    this.#editor.innerHTML = '';
    const textNode = document.createTextNode(content);
    this.#editor.appendChild(textNode);
    this._checkAndTransformComponents();
  }
  
  /**
   * 公共API：获取内容
   */
  getContent() {
    return this.#editor.innerHTML;
  }
  
  /**
   * 公共API：获取组件列表
   */
  getComponents() {
    return Array.from(this.#editor.querySelectorAll('.component')).map(comp => ({
      type: comp.dataset.type,
      id: comp.dataset.id,
      serialized: comp.dataset.serialized
    }));
  }
  
  /**
   * 公共API：设置组件定义
   */
  setComponentDefinitions(definitions) {
    if (Array.isArray(definitions)) {
      this.#componentDefinitions = definitions;
    }
  }
  
  /**
   * 断开连接时清理
   */
  disconnectedCallback() {
    // 移除事件监听器
    const toolbar = this.shadowRoot.querySelector('.toolbar');
    if (toolbar) {
      toolbar.removeEventListener('click', this._handleToolbarClick);
    }
    
    if (this.#editor) {
      this.#editor.removeEventListener('paste', this._handlePaste);
      this.#editor.removeEventListener('input', this._handleInput);
      this.#editor.removeEventListener('keydown', this._handleKeyDown);
    }
  }
}

// 注册自定义元素
customElements.define('rich-text-editor', RichTextEditor);
