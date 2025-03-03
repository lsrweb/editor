class MEditor extends HTMLElement {
  // 静态私有字段，用于存储共享实例
  static _sharedInstance = null;
  
  // 构造函数 - 修复返回不同对象的问题
  constructor() {
    // 必须首先调用super()
    super();
    
    // 不要直接返回其他对象 - 这会违反Web Components规范
    // 而是在首次创建时初始化共享实例，并共享状态
    if (!MEditor._sharedInstance) {
      MEditor._sharedInstance = {
        componentDefinitions: [
          // 淘礼金组件前缀 - 需要ID
          {
            prefix: '{TLJ-PLLJ-',
            suffix: '}',
            type: 'tlj',
            className: 'tlj-component',
            needsId: true,  // 标记此组件需要ID
            formatTitle: (id) => `淘礼金组件: ${id}`,
            icon: ''
          },
          // 京东礼金 - 需要ID
          {
            prefix: '{JDLJ-PLLJ-',
            suffix: '}',
            type: 'jdlj',
            className: 'jdlj-component',
            needsId: true,  // 标记此组件需要ID
            formatTitle: (id) => `京东礼金组件: ${id}`,
            icon: ''
          },
          // 昵称占位符 - 不需要ID
          {
            prefix: '{@昵称',
            suffix: '}',
            type: 'nickname',
            className: 'nickname-component',
            needsId: false,  // 标记此组件不需要ID
            formatTitle: () => '昵称占位符',
            icon: ''
          },
          // 表情符号 - 可能需要表情名称
          {
            prefix: '[',
            suffix: ']',
            type: 'emoji',
            className: 'emoji-component',
            needsId: true,  // 表情需要名称作为ID
            formatTitle: (id) => `表情: ${id}`,
            icon: '',
            noWrap: true  // 特别标记：不对前缀添加额外的{符号
          }
        ],
        observer: null,
        content: '',
        components: [],
        styleOptions: {
          backgroundColor: '',
          fontStyle: 'italic',
          borderWidth: '0',
          color: '',
        },
        editorContent: null,
        instance: this  // 保留对第一个实例的引用
      };
    }
    
    // 存储对共享状态的引用
    this._shared = MEditor._sharedInstance;
    
    // 不在构造函数中创建shadow DOM，避免Vue 2.6.11兼容性问题
    this._shadowRoot = null;
    
    // 在构造函数中只进行基本初始化，不获取属性
    this._initialized = false;
    
    // 存储等待处理的属性
    this._pendingProps = new Map();
    
    // 为Vue和其他框架添加一个特殊的属性/方法接口
    this._vuePropertySetter = (name, value) => {
      if (this._initialized) {
        this._handleExternalPropChange(name, value);
      } else {
        // 存储等待初始化完成后处理的属性
        this._pendingProps.set(name, value);
      }
    };
  }
  
  // 获取组件定义 - 使用共享状态
  get #componentDefinitions() {
    return this._shared.componentDefinitions;
  }
  
  // 设置组件定义 - 使用共享状态
  set #componentDefinitions(value) {
    this._shared.componentDefinitions = value;
  }
  
  // 获取MutationObserver - 使用共享状态
  get #observer() {
    return this._shared.observer;
  }
  
  // 设置MutationObserver - 使用共享状态
  set #observer(value) {
    this._shared.observer = value;
  }
  
  // 获取内容 - 使用共享状态
  get #content() {
    return this._shared.content;
  }
  
  // 设置内容 - 使用共享状态
  set #content(value) {
    this._shared.content = value;
  }
  
  // 获取组件列表 - 使用共享状态
  get #components() {
    return this._shared.components;
  }
  
  // 设置组件列表 - 使用共享状态
  set #components(value) {
    this._shared.components = value;
  }
  
  // 获取样式选项 - 使用共享状态
  get #styleOptions() {
    return this._shared.styleOptions;
  }
  
  // 设置样式选项 - 使用共享状态
  set #styleOptions(value) {
    this._shared.styleOptions = value;
  }
  
  // 当元素被插入到DOM中时调用
  connectedCallback() {
    // 避免重复初始化
    if (this._initialized) {
      // 如果有待处理的内容设置请求，立即处理
      if (this._pendingContentQueue.length > 0) {
        const content = this._pendingContentQueue.shift();
        setTimeout(() => this._setContentImmediately(content), 0);
      }
      return;
    }
    
    // 在connectedCallback中创建shadow DOM，解决Vue 2.6.11兼容性问题
    try {
      this._shadowRoot = this.attachShadow({ mode: 'open' });
    } catch (e) {
      console.error('Failed to attach shadow DOM, using fallback mode', e);
      // 降级方案，使用普通div作为容器
      this._shadowRoot = this;
    }
    
    // 延迟初始化编辑器，确保Vue渲染完成
    setTimeout(() => {
      // 初始化编辑器
      this._initEditor();
      
      // 读取属性
      if (this.hasAttribute('component-definitions')) {
        try {
          const definitions = JSON.parse(this.getAttribute('component-definitions'));
          if (Array.isArray(definitions)) {
            this.#componentDefinitions = definitions;
          }
        } catch (e) {
          console.error('Invalid component-definitions attribute:', e);
        }
      }
      
      // 设置初始化完成标志
      this._initialized = true;
      
      // 处理任何待处理的属性设置
      if (this._pendingProps.size > 0) {
        this._pendingProps.forEach((value, name) => {
          this._handleExternalPropChange(name, value);
        });
        this._pendingProps.clear();
      }
      
      // 处理任何待处理的内容设置请求
      if (this._pendingContentQueue.length > 0) {
        while (this._pendingContentQueue.length > 0) {
          const content = this._pendingContentQueue.shift();
          this._setContentImmediately(content);
        }
      }
      
      // 分发ready事件
      this.dispatchEvent(new CustomEvent('editor-ready', {
        bubbles: true,
        composed: true,
        detail: { editor: this }
      }));
      
      // 更新全局静态实例引用
      MEditor.instance = this;
    }, 0);
  }
  
  // 断开连接时调用
  disconnectedCallback() {
    this._destroyEditor();
  }
  
  // 初始化编辑器
  _initEditor() {
    // 创建编辑器样式
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
      }
      
      .editor-container {
        width: 100%;
        height: 100%;
        border: 1px solid #ccc;
        overflow: auto;
        border-radius:6px;
        min-height: 110px;
      }
      .editor-container::-webkit-scrollbar {
          width: 2px;
          height: 2px;
      }
      .editor-container::-webkit-scrollbar-thumb {
          background-color: #ccc;
          border-radius: 10px;
      }
      .editor-container::-webkit-scrollbar-track {
          background-color: #fff;
      }
      .editor-content {
        min-height: 100%;
        padding: 10px;
        outline: none;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 26px;
      }
      
      .component {
        font-style: italic;
        display: inline-block;
        cursor: pointer;
        user-select: all; /* 确保整个组件作为一个整体被选中 */
        white-space: nowrap; /* 防止换行 */
        position: relative;
        border-radius: 3px;
        margin: 0 2px;
      }
      
      /* 淘礼金组件样式 */
      .tlj-component {
        color: #d81e06;
        background-color: rgba(255, 235, 235, 0.7);
        border: 1px dashed #ffb8b8;
        padding: 0 4px;
      }
      
      /* 京东礼金组件样式 */
      .jdlj-component {
        color: #e1251b;
        background-color: rgba(255, 235, 235, 0.7);
        border: 1px dashed #ff9797;
        padding: 0 4px;
      }
      
      /* 昵称占位符样式 */
      .nickname-component {
        color: #006eff;
        background-color: rgba(235, 245, 255, 0.7);
        border: 1px dashed #b8dcff;
        padding: 0 4px;
      }
      
      /* 表情组件样式 */
      .emoji-component {
        color: #ff9500;
        background-color: rgba(255, 248, 235, 0.7);
        border: 1px dashed #ffd591;
        padding: 0 4px;
      }
      
      /* 通用组件样式 */
      .generic-component {
        color: #36b37e;
        background-color: rgba(235, 255, 246, 0.7);
        border: 1px dashed #b3e6d5;
        padding: 0 4px;
      }
      
      /* 添加悬停效果突显组件是一个整体 */
      .component:hover {
        background-color: rgba(0, 0, 0, 0.05);
        outline: 1px solid rgba(0, 0, 0, 0.2);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      
      /* 添加组件图标
      .component::before {
        content: '';
        display: inline-block;
        width: 14px;
        height: 14px;
        margin-right: 2px;
        background-size: contain;
        background-repeat: no-repeat;
        vertical-align: text-top;
      }
        
      
      .tlj-component::before {
        content: '';
        font-style: normal;
      }
      
      .jdlj-component::before {
        content: '';
        font-style: normal;
      }
      
      .nickname-component::before {
        content: '';
        font-style: normal;
      }
      
      .emoji-component::before {
        content: '';
        font-style: normal;
      }
         */
    `;
    
    // 创建编辑器容器
    const container = document.createElement('div');
    container.className = 'editor-container';
    
    // 创建可编辑内容区域
    const content = document.createElement('div');
    content.className = 'editor-content';
    content.contentEditable = 'true';
    
    container.appendChild(content);
    
    // 添加到shadow DOM
    this._shadowRoot.appendChild(style);
    this._shadowRoot.appendChild(container);
    
    this._editorContent = content;
    
    // 设置事件监听
    this._setupEvents();
    
    // 设置MutationObserver监听内容变化
    this._setupObserver();
  }
  
  // 设置事件监听
  _setupEvents() {
    // 监听输入事件
    this._editorContent.addEventListener('input', this._handleInput.bind(this));
    
    // 监听键盘事件，处理组件的删除
    this._editorContent.addEventListener('keydown', this._handleKeyDown.bind(this));
    
    // 监听粘贴事件，处理纯文本粘贴
    this._editorContent.addEventListener('paste', this._handlePaste.bind(this));
    
    // 监听失去焦点事件，保存光标位置
    this._editorContent.addEventListener('blur', this._handleBlur.bind(this));
    
    // 监听获得焦点事件，清除多余的光标标记
    this._editorContent.addEventListener('focus', this._handleFocus.bind(this));
  }
  
  // 处理失去焦点事件，在当前光标位置插入隐藏元素
  _handleBlur(event) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      // 先清除现有的所有blur_line元素，确保只有一个
      this._removeAllBlurLines();
      
      const range = selection.getRangeAt(0);
      // 检查选区是否在编辑器内
      if (this._editorContent.contains(range.commonAncestorContainer)) {
        const blurLine = document.createElement('div');
        blurLine.className = 'blur_line';
        // 插入隐藏元素到光标位置
        range.insertNode(blurLine);
      }
    }
  }
  
  // 处理获得焦点事件
  _handleFocus(event) {
    // 如果编辑器中有多个blur_line元素，只保留最后一个
    const blurLines = this._editorContent.querySelectorAll('.blur_line');
    if (blurLines.length > 1) {
      for (let i = 0; i < blurLines.length - 1; i++) {
        blurLines[i].remove();
      }
    }
  }
  
  // 移除所有的blur_line元素
  _removeAllBlurLines() {
    const blurLines = this._editorContent.querySelectorAll('.blur_line');
    blurLines.forEach(line => line.remove());
  }
  
  // 设置MutationObserver
  _setupObserver() {
    // 创建观察者监听DOM变化
    this.#observer = new MutationObserver(this._handleMutations.bind(this));
    
    // 配置观察选项
    const config = { 
      childList: true, 
      characterData: true, 
      subtree: true 
    };
    
    // 开始观察
    this.#observer.observe(this._editorContent, config);
  }
  
  // 处理DOM变化
  _handleMutations(mutations) {
    // 更新内部内容状态
    this._updateContent();
    
    // 触发change事件
    this._triggerChangeEvent();
  }
  
  // 处理输入事件
  _handleInput(event) {
    // 检查是否有组件文本被输入（如{TLJ-PLLJ-XXXX}）
    this._checkAndTransformComponents();
    
    // 更新内部内容状态
    this._updateContent();
    
    // 触发change事件
    this._triggerChangeEvent();
  }
  
  // 处理键盘事件
  _handleKeyDown(event) {
    // 如果是删除键或退格键
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selection = window.getSelection();
      
      // 没有选择范围，检查光标位置
      if (selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      
      // 查找并处理所有相关组件
      const components = this._findComponentsInRange(range);
      
      if (components.length > 0) {
        // 阻止默认删除行为
        event.preventDefault();
        
        // 删除所有相关组件
        components.forEach(component => {
          component.remove();
        });
        
        // 更新内部状态
        this._updateContent();
        this._triggerChangeEvent();
      }
    }
    
    // 防止在组件内编辑或删除单个字符
    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList && activeElement.classList.contains('component')) {
      // 如果是修改键，阻止默认行为
      if (event.key === 'Delete' || event.key === 'Backspace' || 
          event.key.length === 1 || event.key === 'Enter' || 
          event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
      }
    }
  }

  // 查找范围中的组件
  _findComponentsInRange(range) {
    const components = [];
    
    // 1. 检查范围是否完全包含或部分包含组件
    if (!range.collapsed) {
      // 获取所有组件
      const allComponents = this._editorContent.querySelectorAll('.component');
      
      allComponents.forEach(component => {
        // 创建包含组件的范围
        const componentRange = document.createRange();
        componentRange.selectNode(component);
        
        // 检查组件是否与选中范围有重叠
        const isOverlapping = (
          range.compareBoundaryPoints(Range.END_TO_START, componentRange) <= 0 &&
          range.compareBoundaryPoints(Range.START_TO_END, componentRange) >= 0
        );
        
        if (isOverlapping) {
          components.push(component);
        }
      });
      
      return components;
    }
    
    // 2. 如果是光标位置(collapsed range)
    // 检查光标是否在组件内部或紧贴组件边界
    let node = range.startContainer;
    
    // 如果光标在文本节点内
    if (node.nodeType === Node.TEXT_NODE) {
      // 检查光标前的组件（删除时）
      if (range.startOffset === 0) {
        let prevNode = node.previousSibling;
        while (prevNode) {
          if (prevNode.nodeType === Node.ELEMENT_NODE && 
              prevNode.classList && 
              prevNode.classList.contains('component')) {
            components.push(prevNode);
            break;
          }
          prevNode = prevNode.previousSibling;
        }
      }
      
      // 检查光标后的组件（Delete键）
      if (range.startOffset === node.textContent.length) {
        let nextNode = node.nextSibling;
        while (nextNode) {
          if (nextNode.nodeType === Node.ELEMENT_NODE && 
              nextNode.classList && 
              nextNode.classList.contains('component')) {
            components.push(nextNode);
            break;
          }
          nextNode = nextNode.nextSibling;
        }
      }
    }
    
    // 如果光标在元素节点内
    else if (node.nodeType === Node.ELEMENT_NODE) {
      // 检查是否就在组件内部
      let currentNode = node;
      while (currentNode && currentNode !== this._editorContent) {
        if (currentNode.classList && currentNode.classList.contains('component')) {
          components.push(currentNode);
          break;
        }
        currentNode = currentNode.parentNode;
      }
      
      // 如果在元素起始处
      if (range.startOffset === 0) {
        // 查找前一个兄弟节点是否为组件
        let child = node.childNodes[0];
        if (child && child.nodeType === Node.ELEMENT_NODE && 
            child.classList && child.classList.contains('component')) {
          components.push(child);
        }
      }
      
      // 如果在元素结尾处
      if (range.startOffset === node.childNodes.length) {
        // 查找最后一个子节点是否为组件
        let child = node.childNodes[node.childNodes.length - 1];
        if (child && child.nodeType === Node.ELEMENT_NODE && 
            child.classList && child.classList.contains('component')) {
          components.push(child);
        }
      }
    }
    
    return components;
  }

  // 处理粘贴事件
  _handlePaste(event) {
    // 阻止默认粘贴行为
    event.preventDefault();
    
    // 获取纯文本
    const text = (event.clipboardData || window.clipboardData).getData('text/plain');
    
    // 将文本插入到选区
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // 插入文本
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // 将光标移动到插入文本的末尾
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 检查粘贴的文本是否包含组件标记
      this._checkAndTransformComponents();
      
      // 更新内部内容状态
      this._updateContent();
      
      // 触发change事件
      this._triggerChangeEvent();
    }
  }
  
  // 检查并转换内容中的组件标记为组件元素 - 更改为两步识别
  _checkAndTransformComponents() {
    // 第一步：对整个文本进行组件识别
    this._processTextNodes(this._editorContent);
    
    // 第二步：确保所有组件不可编辑
    this._ensureComponentsNotEditable();
    
    // 第三步：再次处理，捕获可能因DOM变化新产生的文本
    this._processTextNodes(this._editorContent);
  }
  
  // 递归处理文本节点，查找并转换组件标记
  _processTextNodes(node) {
    // 如果不是节点或已经是组件，直接返回
    if (!node || (node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('component'))) {
      return;
    }
    
    // 如果是文本节点，尝试识别组件
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      
      // 创建一个数组记录所有匹配到的组件
      let allMatches = [];
      
      // 遍历所有组件定义
      for (const definition of this.#componentDefinitions) {
        const escapedPrefix = this._escapeRegExp(definition.prefix);
        const escapedSuffix = this._escapeRegExp(definition.suffix);
        const pattern = `${escapedPrefix}[^${escapedSuffix}]*${escapedSuffix}`;
        const regex = new RegExp(pattern, 'g');
        
        // 查找所有匹配
        let match;
        while ((match = regex.exec(text)) !== null) {
          allMatches.push({
            definition,
            match: match[0],
            start: match.index,
            end: regex.lastIndex,
            content: match[0].substring(definition.prefix.length, match[0].length - definition.suffix.length)
          });
        }
      }
      
      // 如果没有找到任何组件，直接返回
      if (allMatches.length === 0) return;
      
      // 按照起始位置排序匹配到的组件
      allMatches.sort((a, b) => a.start - b.start);
      
      // 创建文档片段
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      // 处理每个匹配
      for (const match of allMatches) {
        // 添加匹配前的文本
        if (match.start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
        }
        
        // 获取组件ID - 如果组件不需要ID，使用组件类型作为ID
        const componentId = match.definition.needsId ? match.content : match.definition.type;
        
        // 创建组件元素
        const componentElement = this._createComponentElement(
          match.match,  // 完整文本
          componentId,  // ID或类型
          match.definition  // 组件定义
        );
        fragment.appendChild(componentElement);
        
        lastIndex = match.end;
      }
      
      // 添加剩余文本
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // 替换原始节点
      const parent = node.parentNode;
      if (parent) {
        parent.replaceChild(fragment, node);
      }
      
      return;
    }
    
    // 如果是元素节点，递归处理其子节点
    if (node.nodeType === Node.ELEMENT_NODE) {
      const childNodes = [...node.childNodes]; // 创建副本避免实时集合问题
      for (const child of childNodes) {
        this._processTextNodes(child);
      }
    }
  }
  
  // 辅助方法，转义正则表达式特殊字符
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示整个匹配的字符串
  }
  
  // 辅助方法，在文本中查找和替换组件
  _replaceWithComponents(text, regex, definition, fragment) {
    let result;
    let lastIndex = 0;
    let remainingText = text;
    
    // 重置正则表达式
    regex.lastIndex = 0;
    
    while ((result = regex.exec(text)) !== null) {
      // 添加组件前的文本
      if (result.index > lastIndex) {
        const beforeText = text.substring(lastIndex, result.index);
        fragment.appendChild(document.createTextNode(beforeText));
      }
      
      // 创建组件元素
      const fullMatch = result[0]; // 完整匹配
      const prefix = result[1]; // 前缀
      const content = result[2]; // 内容
      const suffix = result[3]; // 后缀
      
      // 对于不需要ID的组件，使用类型作为ID
      const componentId = definition.needsId ? content : definition.type;
      
      const componentElement = this._createComponentElement(
        fullMatch, 
        componentId, 
        definition
      );
      fragment.appendChild(componentElement);
      
      lastIndex = regex.lastIndex;
    }
    
    // 返回剩余的文本
    if (lastIndex < text.length) {
      return text.substring(lastIndex);
    }
    
    return '';
  }
  
  // 创建组件元素，增强视觉效果
  _createComponentElement(text, id, definition) {
    const span = document.createElement('span');
    span.className = `component ${definition.className || 'generic-component'}`;
    
    // 使用组件定义中的formatTitle函数生成title
    span.title = definition.formatTitle ? definition.formatTitle(id) : `组件: ${id}`;
    
    span.textContent = text;
    span.dataset.componentId = id;
    span.dataset.componentType = definition.type;
    
    // 设置为不可编辑，防止直接修改内容
    span.contentEditable = 'false';
    
    // 如果组件定义中有图标，添加图标
    if (definition.icon) {
      // 创建一个单独的span来显示图标
      const iconSpan = document.createElement('span');
      iconSpan.className = 'component-icon';
      iconSpan.textContent = definition.icon;
      iconSpan.style.marginRight = '3px';
      
      // 将原始文本和图标一起添加到组件中
      span.textContent = '';  // 清除原始文本
      span.appendChild(iconSpan);
      span.appendChild(document.createTextNode(text));
    }
    
    // 应用样式
    Object.entries(this.#styleOptions).forEach(([key, value]) => {
      if (value) {
        span.style[key] = value;
      }
    });
    
    // 添加删除组件的点击事件
    span.addEventListener('click', (event) => {
      // 如果按住了Ctrl或Shift键，则不处理
      if (event.ctrlKey || event.shiftKey) return;
      
      // 单击时选中整个组件
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNode(span);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 阻止事件冒泡
      event.stopPropagation();
    });
    
    return span;
  }

  // 更新内部内容状态
  _updateContent() {
    this.#content = this._editorContent.innerHTML;
    
    // 更新组件列表
    this.#components = Array.from(this._editorContent.querySelectorAll('.component'))
      .map(el => ({
        text: el.textContent,
        id: el.dataset.componentId
      }));
  }
  
  // 触发change事件
  _triggerChangeEvent() {
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: {
        content: this.getContent(),
        rawContent: this.getRawContent(),
        components: this.#components
      }
    }));
  }
  
  // 清理资源：确保在销毁编辑器时清除定时器
  _destroyEditor() {
    // 清除内容设置的定时器
    if (this._contentSetTimer) {
      clearInterval(this._contentSetTimer);
      this._contentSetTimer = null;
    }
    
    // 停止观察DOM变化
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
    
    // 移除事件监听
    if (this._editorContent) {
      this._editorContent.removeEventListener('input', this._handleInput);
      this._editorContent.removeEventListener('keydown', this._handleKeyDown);
      this._editorContent.removeEventListener('paste', this._handlePaste);
    }
    
    // 触发销毁事件
    this.dispatchEvent(new CustomEvent('editor-destroyed', {
      bubbles: true,
      composed: true
    }));
  }
  
  // 获取富文本内容
  getContent() {
    return this.#content;
  }
  
  // 获取纯文本内容
  getRawContent() {
    return this._editorContent.textContent;
  }
  
  // 改进：添加一个队列来存储待处理的内容设置请求
  _pendingContentQueue = [];
  
  // 设置内容（带组件回显）- 添加等待机制
  setContentWithComponents(content) {
    // 如果编辑器还未初始化或内容区域不存在，将请求加入队列
    if (!this._initialized || !this._editorContent) {
      console.log('Editor not ready yet, queuing content set request');
      this._pendingContentQueue.push(content);
      
      // 如果已经有内容设置的定时器，则不再创建新的
      if (!this._contentSetTimer) {
        // 设置轮询检查，直到编辑器准备好
        this._contentSetTimer = setInterval(() => {
          if (this._initialized && this._editorContent) {
            clearInterval(this._contentSetTimer);
            this._contentSetTimer = null;
            
            // 处理队列中的所有内容
            while (this._pendingContentQueue.length > 0) {
              const pendingContent = this._pendingContentQueue.shift();
              this._setContentImmediately(pendingContent);
            }
          }
        }, 50); // 每50毫秒检查一次
      }
      return;
    }
    
    // 编辑器已准备好，立即设置内容
    this._setContentImmediately(content);
  }
  
  // 内部方法：实际设置内容的逻辑
  _setContentImmediately(content) {
    // 先清空编辑器内容
    this._editorContent.innerHTML = '';
    
    // 创建一个文本节点
    const textNode = document.createTextNode(content);
    this._editorContent.appendChild(textNode);
    
    // 处理文本节点中的组件
    this._checkAndTransformComponents();
    
    // 确保组件不可编辑
    this._ensureComponentsNotEditable();
    
    // 更新内部状态
    this._updateContent();
  }
  
  // 清除内容
  clearContent() {
    if (this._editorContent) {
      this._editorContent.innerHTML = '';
      this._updateContent();
      this._triggerChangeEvent();
    }
  }
  
  // 插入组件 - 修改方法支持从指定位置或blur_line位置插入
  insertComponent(prefix, id, positionElement = null) {
    if (!this._editorContent) return;
    
    // 查找匹配的组件定义
    let matchedDefinition = null;
    // 只有当组件没有标记为noWrap时才添加{前缀
    const shouldAddBrace = prefix.startsWith('[') || prefix.startsWith('{');
    const normalizedPrefix = shouldAddBrace ? prefix : `{${prefix}`;
    
    for (const def of this.#componentDefinitions) {
      if (def.prefix === normalizedPrefix || def.prefix === prefix) {
        matchedDefinition = def;
        break;
      }
    }
    
    // 如果没找到匹配的定义，使用默认定义
    if (!matchedDefinition) {
      matchedDefinition = {
        prefix: normalizedPrefix,
        suffix: '}',
        type: 'generic',
        className: 'generic-component',
        needsId: true,  // 默认需要ID
        formatTitle: (id) => `组件: ${id}`,
        icon: '📎'
      };
    }
    
    // 构建组件文本 - 根据needsId属性决定是否添加ID
    const componentText = matchedDefinition.needsId 
      ? `${matchedDefinition.prefix}${id}${matchedDefinition.suffix}`  // 需要ID的组件
      : `${matchedDefinition.prefix}${matchedDefinition.suffix}`;      // 纯占位符，无需ID
    
    // 创建组件元素 - 对于不需要ID的组件，使用类型作为ID
    const componentId = matchedDefinition.needsId ? id : matchedDefinition.type;
    
    // 创建组件元素
    const componentElement = this._createComponentElement(
      componentText, 
      componentId, 
      matchedDefinition
    );
    
    // 确保编辑器获得焦点
    this._editorContent.focus();
    
    // 查找是否存在blur_line元素
    const blurLine = positionElement || this._editorContent.querySelector('.blur_line');
    
    let range;
    if (blurLine) {
      // 如果存在blur_line，则从blur_line位置插入
      range = document.createRange();
      range.setStartBefore(blurLine);
      range.setEndBefore(blurLine);
      // 移除blur_line元素
      blurLine.remove();
    } else {
      // 否则使用当前选区
      const selection = window.getSelection();
      
      if (selection.rangeCount > 0) {
        // 使用现有选区
        range = selection.getRangeAt(0);
        
        // 检查选区是否在编辑器内部
        if (!this._editorContent.contains(range.commonAncestorContainer)) {
          // 如果选区不在编辑器内部，创建一个新的范围在编辑器末尾
          range = document.createRange();
          range.selectNodeContents(this._editorContent);
          range.collapse(false); // 折叠到末尾
        }
      } else {
        // 创建一个新的范围，放在编辑器的末尾
        range = document.createRange();
        range.selectNodeContents(this._editorContent);
        range.collapse(false); // 折叠到末尾
      }
    }
    
    // 插入组件
    range.deleteContents();
    range.insertNode(componentElement);
    
    // 将光标移到组件后面
    range.setStartAfter(componentElement);
    range.setEndAfter(componentElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // 更新内部状态
    this._updateContent();
    this._triggerChangeEvent();
    
    // 保持编辑器聚焦
    this._editorContent.focus();
  }
  
  // 设置组件前缀列表 - 兼容层
  setComponentPrefixes(prefixes) {
    if (Array.isArray(prefixes)) {
      // 将简单前缀转换为完整的定义
      const newDefinitions = prefixes.map(prefix => {
        // 确保前缀格式正确
        const formattedPrefix = prefix.startsWith('{') ? prefix : `{${prefix}`;
        return {
          prefix: formattedPrefix,
          suffix: '}',
          type: 'generic',
          className: 'generic-component',
          needsId: true  // 默认需要ID
        };
      });
      
      // 更新定义集合
      this.#componentDefinitions = newDefinitions;
    }
  }
  
  // 获取组件前缀列表 - 兼容层
  getComponentPrefixes() {
    // 从componentDefinitions中提取前缀
    return this.#componentDefinitions.map(def => {
      // 移除前缀中的 { 符号
      const prefix = def.prefix.startsWith('{') ? def.prefix.substring(1) : def.prefix;
      return prefix;
    });
  }
  
  // 添加组件前缀 - 兼容层
  addComponentPrefix(prefix) {
    if (prefix && typeof prefix === 'string') {
      // 检查此前缀是否已存在
      const exists = this.#componentDefinitions.some(def => {
        const existingPrefix = def.prefix.startsWith('{') ? def.prefix.substring(1) : def.prefix;
        return existingPrefix === prefix;
      });
      
      if (!exists) {
        // 添加新定义
        this.#componentDefinitions.push({
          prefix: prefix.startsWith('{') ? prefix : `{${prefix}`,
          suffix: '}',
          type: 'generic',
          className: 'generic-component',
          needsId: true  // 默认需要ID
        });
      }
    }
  }
  
  // 设置组件样式
  setComponentStyle(styleOptions) {
    if (styleOptions && typeof styleOptions === 'object') {
      this.#styleOptions = {
        ...this.#styleOptions,
        ...styleOptions
      };
      
      // 更新已有组件的样式
      const componentElements = this._editorContent.querySelectorAll('.component');
      componentElements.forEach(el => {
        Object.entries(this.#styleOptions).forEach(([key, value]) => {
          if (value) {
            el.style[key] = value;
          } else {
            el.style[key] = ''; // 重置未定义的样式
          }
        });
      });
    }
  }
  
  // 获取当前组件样式
  getComponentStyle() {
    return {...this.#styleOptions};
  }
  
  // 获取组件定义列表
  getComponentDefinitions() {
    return [...this.#componentDefinitions];
  }
  
  // 设置组件定义列表
  setComponentDefinitions(definitions) {
    if (Array.isArray(definitions)) {
      this.#componentDefinitions = definitions;
    }
  }
  
  // 添加组件定义
  addComponentDefinition(definition) {
    if (definition && 
        typeof definition === 'object' && 
        definition.prefix && 
        definition.suffix && 
        definition.type) {
      
      // 确保definition有所有需要的属性
      const defaultDefinition = {
        needsId: true,
        className: `${definition.type}-component`,
        formatTitle: (id) => `${definition.type}: ${id}`,
        icon: '',
        noWrap: false
      };
      
      // 合并默认值和提供的值
      const completeDefinition = {...defaultDefinition, ...definition};
      
      // 检查是否已存在相同前缀和后缀的定义
      const existingIndex = this.#componentDefinitions.findIndex(
        def => def.prefix === completeDefinition.prefix && def.suffix === completeDefinition.suffix
      );
      
      if (existingIndex >= 0) {
        // 更新已有定义
        this.#componentDefinitions[existingIndex] = completeDefinition;
      } else {
        // 添加新定义
        this.#componentDefinitions.push(completeDefinition);
      }
    }
  }
  
  // 获取编辑器实例（用于对外暴露）
  static getInstance() {
    return MEditor._sharedInstance ? MEditor._sharedInstance.instance : null;
  }
  
  // 观察属性变化
  static get observedAttributes() {
    return ['component-definitions'];
  }
  
  // 属性变化回调
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'component-definitions' && newValue !== oldValue) {
      try {
        const definitions = JSON.parse(newValue);
        if (Array.isArray(definitions)) {
          this.#componentDefinitions = definitions;
        }
      } catch (e) {
        console.error('Invalid component-definitions attribute:', e);
      }
    }
  }

  // 增强外部属性处理，考虑组件未初始化的情况
  _handleExternalPropChange(name, value) {
    // 处理不同的属性
    if (name === 'componentDefinitions' && value) {
      try {
        const definitions = Array.isArray(value) ? value : JSON.parse(value);
        if (Array.isArray(definitions)) {
          this.#componentDefinitions = definitions;
        }
      } catch (e) {
        console.error('Invalid componentDefinitions value:', e);
      }
    } else if (name === 'styleOptions' && value) {
      if (typeof value === 'object') {
        this.setComponentStyle(value);
      }
    } else if (name === 'content' && value !== undefined) {
      // 使用增强的setContentWithComponents方法，它会处理未初始化情况
      this.setContentWithComponents(value);
    }
  }
  
  // 添加Vue兼容的自定义属性访问器
  get vModel() {
    return this.getContent();
  }
  
  set vModel(value) {
    this.setContentWithComponents(value || '');
  }

  // 添加新方法确保组件不可编辑
  _ensureComponentsNotEditable() {
    // 为所有组件添加contentEditable=false
    const components = this._editorContent.querySelectorAll('.component');
    components.forEach(component => {
      component.contentEditable = 'false';
    });
  }

  // 添加一个调试方法来分析文本中的组件
  _analyzeText(text) {
    const results = [];
    
    for (const definition of this.#componentDefinitions) {
      const escapedPrefix = this._escapeRegExp(definition.prefix);
      const escapedSuffix = this._escapeRegExp(definition.suffix);
      const pattern = `(${escapedPrefix})([^${escapedSuffix}]*)(${escapedSuffix})`;
      const regex = new RegExp(pattern, 'g');
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          full: match[0],
          prefix: match[1],
          content: match[2],
          suffix: match[3],
          position: match.index,
          type: definition.type
        });
      }
    }
    
    return results.sort((a, b) => a.position - b.position);
  }
  
  // 提供一个公共方法用于测试组件识别
  testComponentRecognition(text) {
    return this._analyzeText(text);
  }

  // 辅助方法：获取焦点
  focus() {
    if (this._editorContent) {
      this._editorContent.focus();
    }
  }
}

// 注册WebComponent
if (!customElements.get('m-editor')) {
  // 添加静态属性，用于跟踪编辑器准备状态和回调
  MEditor.isReady = false;
  MEditor.readyCallbacks = [];
  MEditor.instance = null;
  
  // 添加editor-ready静态方法，用于确保编辑器已初始化
  MEditor.ready = function(callback) {
    if (typeof callback !== 'function') return;
    
    if (MEditor.isReady && MEditor.instance) {
      // 如果编辑器已经准备好，立即执行回调
      setTimeout(() => callback(MEditor.instance), 0);
    } else {
      // 否则，将回调添加到队列
      MEditor.readyCallbacks.push(callback);
    }
  };
  
  // 监听编辑器就绪事件
  document.addEventListener('editor-ready', function(event) {
    // 标记编辑器为就绪状态
    MEditor.isReady = true;
    
    // 执行所有等待的回调
    while (MEditor.readyCallbacks.length > 0) {
      const callback = MEditor.readyCallbacks.shift();
      try {
        callback(event.detail.editor);
      } catch (e) {
        console.error('Error in editor-ready callback:', e);
      }
    }
  }, { once: false });
  
  // 增强与Vue的兼容性
  MEditor.prototype._upgradeProperty = function(prop) {
    if (this.hasOwnProperty(prop)) {
      const value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  };
  
  // Vue 3的defineCustomElement兼容方法
  MEditor.defineCustomElement = function() {
    if (!customElements.get('m-editor')) {
      customElements.define('m-editor', MEditor);
    }
    return MEditor;
  };
  
  // 注册组件
  try {
    // 注册组件
    customElements.define('m-editor', MEditor);
  } catch (e) {
    console.error('Failed to define m-editor custom element:', e);
  }
  
  // 解决Vue 2.6.11问题的特殊处理
  if (typeof window.Vue !== 'undefined' && window.Vue.version && window.Vue.version.startsWith('2.')) {
    console.log('Vue 2.x detected, applying compatibility fixes');
    
    // 防止Vue直接操作自定义元素
    if (window.Vue.config && window.Vue.config.ignoredElements) {
      // 添加m-editor到忽略元素列表
      if (Array.isArray(window.Vue.config.ignoredElements)) {
        window.Vue.config.ignoredElements.push('m-editor');
      } else {
        window.Vue.config.ignoredElements = ['m-editor'];
      }
    }
  }
}

// 导出MEditor类，便于直接引用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MEditor;
} else if (typeof window !== 'undefined') {
  window.MEditor = MEditor;
}
