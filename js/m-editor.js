/**
 * 富文本编辑器组件
 */
class MEditor extends HTMLElement {
  static components = new Map();

  /**
   * 检测是否为Vue环境
   */
  static isVueEnvironment() {
    return typeof window !== 'undefined' && typeof window.Vue !== 'undefined';
  }

  /**
   * 注册新组件
   * @param {string} type 组件类型
   * @param {object} config 组件配置
   */
  static registerComponent(type, config) {
    // 保存组件默认配置
    MEditor.components.set(type, {
      ...config,
      defaultConfig: {
        prefix: config.prefix,
        template: config.template || '${prefix}_${value}',
        // 可以添加更多默认配置...
      }
    });
  }

  /**
   * 获取已注册的组件
   * @param {string} type 组件类型
   */
  static getComponent(type) {
    return MEditor.components.get(type);
  }

  constructor() {
    super();

    // 保存原始MutationObserver的引用
    this._origMutationObserver = window.MutationObserver;

    // 延迟DOM操作的属性初始化
    this._initialized = false;
    this._editorContainer = null;
    this._clearButton = null;

    // Vue环境适配标记
    this._isVueEnvironment = MEditor.isVueEnvironment();

    // 存储onReady回调
    this._readyCallbacks = [];

    // 内部数据值，用于双向绑定
    this._value = '';

    // 防止事件递归的标志
    this._updating = false;

    // 标记是否正在进行回显操作的标志
    this._isRestoring = false;
  }

  /**
   * 创建清空按钮
   * 移到connectedCallback以外，作为辅助方法
   */
  _createClearButton() {
    // 创建按钮容器，设置为相对定位，使按钮可以绝对定位在其中
    this._editorContainer = document.createElement('div');
    // 分开设置类名，避免在创建时设置属性
    this._editorContainer.className = 'm-editor-container';

    // 创建清空按钮
    this._clearButton = document.createElement('button');
    this._clearButton.className = 'm-editor-clear-btn';
    this._clearButton.innerHTML = '×';
    this._clearButton.title = '清空内容';

    // 添加点击事件，清空编辑器内容
    this._clearButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._clearContent();
    });

    // 初始状态为隐藏，分开设置样式
    this._clearButton.style.opacity = '0';
    this._clearButton.style.visibility = 'hidden';
  }


  _clearContent() {
    // 清空内容
    this.innerHTML = '';
    // 清理任何可能的空标签
    this._cleanEmptyNodes();
    // 确保更新绑定值
    this._updateValueFromContent();
    // 检查占位符
    this._checkPlaceholder();
    // 将焦点设置回编辑器
    this.focus();
  }

  /**
 * 清除编辑器所有内容
 * @returns {MEditor} 编辑器实例，支持链式调用
 */
  clearContent() {
    // 如果编辑器被禁用，不执行清除操作
    if (this.disabled) return this;

    // 调用内部清除方法
    this._clearContent();

    // 触发清除内容事件，允许外部组件响应
    this.dispatchEvent(new CustomEvent('content-cleared', {
      bubbles: true,
      detail: { editor: this }
    }));
    console.log('清空内容');

    return this;
  }


  /**
   * 连接到DOM时调用
   * 准备DOM结构、设置事件监听器等
   * */
  connectedCallback() {
    // 在连接到DOM时设置属性，而非构造函数中
    this.setAttribute('contenteditable', this.disabled ? 'false' : 'true');
    this.setAttribute('spellcheck', 'false');

    // 创建清空按钮（延迟到这里创建DOM）
    if (!this._clearButton) {
      this._createClearButton();
    }

    // 适配Vue环境
    if (this._isVueEnvironment) {
      // 在Vue环境下，可能需要延迟执行DOM操作以确保Vue已完成处理
      setTimeout(() => this._initializeEditor(), 16);
    } else {
      // 非Vue环境，直接初始化
      this._initializeEditor();
    }

    // 检查是否禁用
    this._updateDisabledState();
  }

  /**
   * 初始化编辑器
   * 将关键初始化逻辑移到这里，确保DOM已准备好
   */
  _initializeEditor() {
    if (this._initialized) return;

    // 准备DOM结构
    this._setupClearButton();
    // 设置事件监听器
    this._setupListeners();
    this._setupPlaceholder();

    this._initialized = true;

    // 触发组件就绪事件
    this.dispatchEvent(new CustomEvent('editor-ready', {
      bubbles: true,
      detail: { editor: this }
    }));

    // 执行所有注册的onReady回调
    this._executeReadyCallbacks();
  }

  /**
   * 执行所有注册的onReady回调
   * @private
   */
  _executeReadyCallbacks() {
    // 确保在异步环境中执行，以避免在回调中的错误影响编辑器初始化
    setTimeout(() => {
      while (this._readyCallbacks.length > 0) {
        try {
          const callback = this._readyCallbacks.shift();
          if (typeof callback === 'function') {
            callback(this);
          }
        } catch (err) {
          console.error('执行onReady回调时出错:', err);
        }
      }
    }, 0);
  }

  /**
   * 注册一个在编辑器准备就绪时调用的回调函数
   * @param {Function} callback 当编辑器准备就绪时调用的回调函数
   * @returns {MEditor} 编辑器实例，支持链式调用
   */
  onReady(callback) {
    if (typeof callback !== 'function') {
      console.warn('onReady方法需要一个函数参数');
      return this;
    }

    if (this._initialized) {
      // 如果编辑器已初始化，立即执行回调
      setTimeout(() => callback(this), 0);
    } else {
      // 否则，将回调添加到队列
      this._readyCallbacks.push(callback);
    }

    return this;
  }

  disconnectedCallback() {
    this._removeListeners();
  }

  /**
   * 设置清空按钮
   */
  _setupClearButton() {
    // 检查是否已经设置过
    if (this.parentNode && this.parentNode.classList.contains('m-editor-container')) {
      return;
    }

    // 获取父元素
    const parent = this.parentNode;
    if (!parent) return; // 安全检查

    // 将编辑器包装在容器中
    parent.insertBefore(this._editorContainer, this);
    this._editorContainer.appendChild(this);

    // 将清空按钮添加到容器
    this._editorContainer.appendChild(this._clearButton);

  }

  /**
 * 设置事件监听器
 */
  _setupListeners() {
    // 处理光标位置和粘贴事件
    this.addEventListener('paste', this._handlePaste.bind(this));
    this.addEventListener('keydown', this._handleKeydown.bind(this));

    // 添加输入事件监听，清理空标签，更新值
    this.addEventListener('input', this._handleInput.bind(this));

    // 添加键盘删除事件监听，处理全选删除情况
    this.addEventListener('keyup', (e) => {
      // 删除键或退格键可能触发全选删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        this._updateValueFromContent();
      }
    });

    // 监听组件更新事件
    this.addEventListener('component-updated', this._handleComponentUpdated.bind(this));

    this._editorContainer.addEventListener('mouseenter', () => this._showClearButton());
    this._editorContainer.addEventListener('mouseleave', () => this._hideClearButton());

    // 监听DOM变化，处理自定义组件
    this._observer = new MutationObserver(this._handleMutations.bind(this));
    this._observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }


  /**
   * 处理组件更新事件
   * @param {CustomEvent} event 组件更新事件
   * @private
   */
  _handleComponentUpdated(event) {
    // 阻止冒泡，避免重复处理
    event.stopPropagation();

    // 检查是否正在更新中，避免重复触发
    if (this._updating) {
      console.log('组件更新事件 - 正在更新中，忽略');
      return;
    }

    console.log('处理组件更新事件');
    // 使用防抖动机制更新，避免短时间内多次更新
    this._updateValueFromContent();
  }


  /**
   * 处理输入事件
   * @private
   */
  _handleInput(e) {
    // 如果正在更新中，不要处理输入事件以避免递归
    if (this._updating) return;

    // 如果内容为空，清理可能的空标签
    if (!this.textContent.trim()) {
      this._cleanEmptyNodes();
    }

    // 立即更新值以修复首字符不生效的问题
    this._updateValueFromContent();
  }

  /**
   * 移除事件监听器
   */
  _removeListeners() {
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  /**
   * 显示清空按钮
   */
  _showClearButton() {

    // 只有当编辑器有内容时才显示清空按钮
    if (this.textContent.trim()) {
      this._clearButton.style.visibility = 'visible';
      this._clearButton.style.opacity = '1';
    }
  }

  /**
   * 隐藏清空按钮
   */
  _hideClearButton() {
    this._clearButton.style.opacity = '0';
    // 使用setTimeout确保动画完成后再隐藏按钮
    setTimeout(() => {
      // 检查是否真的应该隐藏（防止快速移入移出导致的闪烁）
      if (this._clearButton.style.opacity === '0') {
        this._clearButton.style.visibility = 'hidden';
      }
    }, 200); // 与CSS过渡时间相匹配
  }

  /**
   * 设置占位符
   */
  _setupPlaceholder() {
    if (this.hasAttribute('placeholder')) {
      // 如果元素为空，添加placeholder类
      this._checkPlaceholder();
      this.addEventListener('input', this._checkPlaceholder.bind(this));
      this.addEventListener('focus', this._checkPlaceholder.bind(this));
      this.addEventListener('blur', this._checkPlaceholder.bind(this));
    }
  }

  /**
   * 检查并处理占位符
   */
  _checkPlaceholder() {
    // 检查是否有文本内容或子元素组件
    const hasContent = this.textContent.trim() || this.querySelector('[id^="block-"]');
    if (!hasContent) {
      this.classList.add('empty');
      // 如果为空，清理所有空标签
      this._cleanEmptyNodes();
      // 如果为空，也隐藏清空按钮
      this._hideClearButton();
    } else {
      this.classList.remove('empty');
    }
  }

  /**
   * 处理粘贴事件
   */
  _handlePaste(e) {
    e.preventDefault();

    // 检查是否有HTML内容
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html && html.trim()) {
      // 如果有HTML内容，直接插入HTML保持格式
      document.execCommand('insertHTML', false, html);
    } else {
      // 否则处理纯文本，识别优惠券代码
      const processedText = this._processPastedText(text);
      document.execCommand('insertHTML', false, processedText);
    }
  }

  /**
 * 处理粘贴文本，识别并转换优惠券格式
 * @param {string} text 粘贴的文本
 * @param {boolean} isRestore 是否是回显操作
 * @param {Object} customData 自定义数据
 * @returns {string} 处理后的HTML或文本
 */
  _processPastedText(text, isRestore = false, customData = {}) {
    if (!text) return '';

    console.log('原始内容:', text, '是否回显:', isRestore);

    // 防止重复处理已经转换为HTML的内容
    if (text.indexOf('<taobao-coupon') >= 0 ||
      text.indexOf('<jd-coupon') >= 0) {
      return text;
    }

    const fragments = [];
    let lastIndex = 0;
    let modified = false;

    // 首先尝试匹配所有的组件标记
    // 更新正则表达式，使其支持更多特殊字符
    // 匹配格式: {前缀-后缀-任意字符}
    const componentRegex = /\{([A-Z0-9]+-[A-Z0-9]+-[^}]+)\}/g;
    let componentMatch;

    // 重置正则的lastIndex，确保从头开始匹配
    componentRegex.lastIndex = 0;

    while ((componentMatch = componentRegex.exec(text)) !== null) {
      const fullMatch = componentMatch[0];            // 完整匹配 {TLJ-PLLJ-1iTgI9}
      const codeWithPrefix = componentMatch[1];       // TLJ-PLLJ-1iTgI9

      const startPos = componentMatch.index;
      const endPos = startPos + fullMatch.length;

      // 将前面未处理的文本添加到结果
      if (startPos > lastIndex) {
        fragments.push(text.substring(lastIndex, startPos));
      }

      // 尝试识别代码属于哪个组件
      let matchedComponent = false;

      // 调试输出
      console.log('匹配到组件:', fullMatch, '代码:', codeWithPrefix, '是否回显:', isRestore);

      MEditor.components.forEach((config, type) => {
        if (!config.prefix || matchedComponent) return;

        const prefix = config.prefix;

        // 检查当前匹配是否以组件前缀开始
        if (codeWithPrefix.startsWith(prefix)) {
          console.log(`${codeWithPrefix} 匹配组件 ${type} 前缀: ${prefix}`);

          // 确保不匹配包含<<NULL>>的无效值
          if (codeWithPrefix.includes('<<NULL>>')) {
            fragments.push(fullMatch);
            matchedComponent = true;
            return;
          }

          // 从代码中提取真正的代码部分（不带前缀）
          // 使用更灵活的方式提取代码，支持特殊字符
          const code = codeWithPrefix.substring(prefix.length).replace(/^[-_]/, '');
          console.log('提取的代码:', code);

          // 创建组件时，确保传递原始格式信息
          const extraData = {
            originalFormat: fullMatch,
            ...(customData[fullMatch] || {}) // 合并与此组件匹配的自定义数据
          };

          // 创建组件并添加到结果 - 标记为回显组件
          const component = this._createCouponComponent(type, code, isRestore, extraData);
          fragments.push(component.outerHTML);
          matchedComponent = true;
          console.log('创建组件成功:', component.outerHTML);
        }
      });

      // 如果没有匹配到组件，保留原始文本
      if (!matchedComponent) {
        fragments.push(fullMatch);
        console.log('未匹配到组件类型，保留原文:', fullMatch);
      }

      lastIndex = endPos;
      modified = true;
    }

    // 然后尝试匹配特殊格式 - 例如 {@昵称}1212{TLJ-PLLJ-1iTgI9}
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      const specialFormatResult = this._processSpecialFormat(remaining, isRestore);

      if (specialFormatResult.modified) {
        fragments.push(specialFormatResult.content);
        modified = true;
        lastIndex = text.length;
      }
    }

    // 如果还有未处理的文本，继续处理常规组件格式
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      const standardResult = this._processStandardFormat(remainingText, isRestore);

      fragments.push(standardResult.content);
      if (standardResult.modified) {
        modified = true;
      }
    }

    const result = modified ? fragments.join('') : text;
    console.log('处理后的内容:', result);
    return result;
  }

  /**
   * 处理特殊格式 - 例如 {@昵称}1212{TLJ-PLLJ-1iTgI9}
   * @private
   */
  _processSpecialFormat(text, isRestore) {
    const fragments = [];
    let lastIndex = 0;
    let modified = false;

    // 此正则模式捕获花括号格式的代码
    const specialFormat = /(\{@[^}]+\}.*?)(\{([A-Z0-9]+-[A-Z0-9]+-[^}]+)\})/g;
    let specialMatch;

    // 重置正则的lastIndex，确保从头开始匹配
    specialFormat.lastIndex = 0;

    while ((specialMatch = specialFormat.exec(text)) !== null) {
      const fullMatch = specialMatch[0];            // 完整匹配
      const beforePart = specialMatch[1];           // {@昵称}1212
      const bracketedCode = specialMatch[2];        // {TLJ-PLLJ-1iTgI9}
      const codeWithPrefix = specialMatch[3];       // TLJ-PLLJ-1iTgI9

      const startPos = specialMatch.index;
      const endPos = startPos + fullMatch.length;

      // 将前面未处理的文本添加到结果
      if (startPos > lastIndex) {
        fragments.push(text.substring(lastIndex, startPos));
      }

      // 尝试识别代码属于哪个组件
      let matchedComponent = false;
      MEditor.components.forEach((config, type) => {
        if (!config.prefix || matchedComponent) return;

        const prefix = config.prefix;
        if (codeWithPrefix.startsWith(prefix)) {
          // 确保不匹配包含<<NULL>>的无效值
          if (codeWithPrefix.includes('<<NULL>>')) {
            fragments.push(fullMatch);
            matchedComponent = true;
            return;
          }

          // 从代码中提取真正的代码部分（不带前缀）
          const code = codeWithPrefix.substring(prefix.length).replace(/^[-_]/, '');

          // 创建组件并添加到结果 - 标记为回显组件
          const component = this._createCouponComponent(type, code, isRestore);
          fragments.push(beforePart);  // 添加前缀部分，如 {@昵称}1212
          fragments.push(component.outerHTML);  // 添加组件HTML
          matchedComponent = true;
        }
      });

      // 如果没有匹配到组件，保留原始文本
      if (!matchedComponent) {
        fragments.push(fullMatch);
      }

      lastIndex = endPos;
      modified = true;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      fragments.push(text.substring(lastIndex));
    }

    return {
      content: fragments.join(''),
      modified: modified
    };
  }

  /**
   * 处理标准格式的组件
   * @private
   */
  _processStandardFormat(text, isRestore) {
    const fragments = [];
    let lastIndex = 0;
    let modified = false;

    // 对每个组件类型定义通用的匹配规则
    MEditor.components.forEach((config, type) => {
      if (!config.prefix) return; // 只处理有前缀的组件

      const prefix = config.prefix;
      const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      // 创建匹配规则数组
      const patterns = this._getMatchPatterns(type, escapedPrefix);

      // 应用每个规则进行匹配
      for (const pattern of patterns) {
        let match;
        // 重置正则表达式的lastIndex，确保从头开始匹配
        pattern.regex.lastIndex = 0;

        while ((match = pattern.regex.exec(text)) !== null) {
          // 跳过包含<<NULL>>的无效值
          const fullMatch = match[0];
          if (fullMatch.includes('<<NULL>>')) {
            continue;
          }

          const code = pattern.extract(match);
          const startPos = match.index;
          const endPos = startPos + fullMatch.length;

          // 添加前面未处理的文本
          if (startPos > lastIndex) {
            fragments.push(text.substring(lastIndex, startPos));
          }

          // 创建组件并添加到结果 - 标记为回显组件
          const component = this._createCouponComponent(type, code, isRestore);
          fragments.push(component.outerHTML);

          lastIndex = endPos;
          modified = true;
        }
      }
    });

    // 添加剩余文本
    if (lastIndex < text.length) {
      fragments.push(text.substring(lastIndex));
    }

    return {
      content: fragments.join(''),
      modified: modified
    };
  }

  /**
   * 获取组件类型的匹配模式
   * @param {string} type 组件类型
   * @param {string} escapedPrefix 转义后的前缀
   * @returns {Array} 匹配模式数组
   */
  _getMatchPatterns(type, escapedPrefix) {
    // 获取组件配置
    const componentConfig = MEditor.getComponent(type);
    if (!componentConfig) return [];

    // 检查组件是否定义了自己的匹配规则
    if (componentConfig.getPatterns && typeof componentConfig.getPatterns === 'function') {
      // 使用组件自定义的匹配规则
      return componentConfig.getPatterns(escapedPrefix);
    }

    // 如果组件没有定义匹配规则，使用通用规则
    const patterns = [];

    // 提取模板信息 - 如果组件配置了默认模板
    const template = componentConfig.defaultConfig?.template;

    // 基于组件类型和模板自动构建匹配规则
    if (type.includes('taobao')) {
      // 淘宝礼金的花括号格式 {TLJ-PLLJ-1iTgI9}，支持更多特殊字符
      patterns.push({
        regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, 'g'),
        extract: (match) => match[1]
      });

      // 处理带连字符的格式 TLJ-PLLJ-1iTgI9
      patterns.push({
        regex: new RegExp(`${escapedPrefix}-([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, 'g'),
        extract: (match) => match[1]
      });

      // 如果模板存在且包含特定格式，添加基于模板的匹配
      if (template) {
        // 从模板构建正则表达式
        const templatePattern = this._createPatternFromTemplate(template, escapedPrefix);
        if (templatePattern) {
          patterns.push(templatePattern);
        }
      }
    }
    else if (type.includes('jd')) {
      // 京东礼金的花括号格式 {TLJ-PLJDLJ-code}，支持更多特殊字符
      patterns.push({
        regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, 'g'),
        extract: (match) => match[1]
      });

      // 如果模板存在且包含特定格式，添加基于模板的匹配
      if (template) {
        // 从模板构建正则表达式
        const templatePattern = this._createPatternFromTemplate(template, escapedPrefix);
        if (templatePattern) {
          patterns.push(templatePattern);
        }
      }
    }
    else {
      // 对于其他类型的组件，添加花括号格式的通用匹配模式
      patterns.push({
        regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, 'g'),
        extract: (match) => match[1]
      });

      // 对于其他类型的组件，尝试创建一个通用的匹配模式
      patterns.push({
        regex: new RegExp(`\\[${escapedPrefix}[_-]?([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)\\]`, 'g'),
        extract: (match) => match[1]
      });

      patterns.push({
        regex: new RegExp(`${escapedPrefix}[_-]([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, 'g'),
        extract: (match) => match[1]
      });
    }

    return patterns;
  }

  /**
   * 从模板创建匹配模式
   * @param {string} template 模板字符串
   * @param {string} escapedPrefix 转义后的前缀
   * @returns {Object|null} 匹配模式对象
   */
  _createPatternFromTemplate(template, escapedPrefix) {
    try {
      // 将模板转换为正则表达式
      // 例如将 ${prefix}_${value} 转换为匹配 PREFIX_VALUE 的正则

      // 替换变量占位符为适当的正则表达式捕获组，支持更多字符
      let patternStr = template
        .replace(/\${prefix\+value}/g, `${escapedPrefix}([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`)
        .replace(/\${prefix}[_-]?\${value}/g, `${escapedPrefix}[_-]?([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`)
        .replace(/\${prefix}/g, escapedPrefix)
        .replace(/\${value}/g, '([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)');

      // 处理特殊符号
      patternStr = patternStr.replace(/[{}]/g, '\\$&');

      return {
        regex: new RegExp(patternStr, 'g'),
        extract: (match) => {
          // 尝试找到捕获组
          for (let i = 1; i < match.length; i++) {
            if (match[i]) return match[i];
          }
          return '';
        }
      };
    } catch (err) {
      console.warn('从模板创建匹配模式失败:', err, template);
      return null;
    }
  }

  /**
   * 创建优惠券组件
   * @param {string} type 组件类型
   * @param {string} code 优惠券代码
   * @param {boolean} isRestore 是否为回显创建的组件
   * @param {Object} extraData 额外的组件数据
   * @returns {HTMLElement} 创建的组件
   */
  _createCouponComponent(type, code, isRestore = false, extraData = {}) {

    const componentConfig = MEditor.getComponent(type);
    if (!componentConfig || !componentConfig.constructor) {
      return document.createTextNode(`[${type}:${code}]`);
    }

    // 创建组件实例
    const component = new componentConfig.constructor();

    // 设置唯一ID
    const blockId = `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    component.id = blockId;

    // 设置前缀
    if (componentConfig.prefix) {
      component.setPrefix(componentConfig.prefix);
    }

    // 设置默认模板
    if (componentConfig.defaultConfig && componentConfig.defaultConfig.template) {
      component.setTemplate(componentConfig.defaultConfig.template);
    }

    // 确保回显标志被正确设置到配置中
    const mergedConfig = {
      ...componentConfig.defaultConfig,
      label_key: 'name',
      value_key: 'code',
      default_text: "替换组件",
      isRestore: isRestore  // 明确设置回显标志
    };

    // 设置配置项
    component.setConfig(mergedConfig);

    // 计算显示文本 - 首选使用原始格式（如果有）
    // 这里需要确保当有原始格式时，无论什么情况都优先使用它
    let displayText = '';
    const originalFormat = extraData.originalFormat || '';

    if (isRestore && originalFormat) {
      displayText = originalFormat;
      console.log('使用原始格式创建组件:', originalFormat);
    } else if (isRestore) {
      displayText = (type.includes('taobao') ? '淘宝礼金: ' : '京东礼金: ') + code;
      console.log('使用生成的格式创建组件:', displayText);
    } else {
      displayText = mergedConfig.default_text || (type.includes('taobao') ? '淘宝礼金' : '京东礼金');
    }

    // 明确添加CSS类以标记回显组件
    if (isRestore) {
      component.classList.add('is-restore');
    }

    // 设置组件数据 - 确保originalFormat被设置
    const componentData = {
      id: blockId,
      value: code, // 保存原始值
      displayText: displayText,
      selectedItem: { [mergedConfig.value_key]: code, code: code }, // 确保code值存在
      isRestore: isRestore, // 在数据中也标记是否为回显数据
      originalFormat: originalFormat, // 保存原始格式
      ...extraData // 合并其他额外数据
    };

    // 输出调试信息
    console.log('创建组件数据:', componentData);

    // 设置组件数据
    component.setData(componentData);

    // 明确调用setRestoreStatus方法设置回显状态
    if (isRestore && typeof component.setRestoreStatus === 'function') {
      component.setRestoreStatus(true);
    }

    return component;
  }

  /**
   * 处理键盘事件
   */
  _handleKeydown(e) {
    // 处理Tab键
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }

    // 处理全选+删除的情况 (Ctrl+A 然后 Delete 或 Backspace)
    if ((e.key === 'Delete' || e.key === 'Backspace') &&
      this.textContent.length > 0 &&
      window.getSelection().toString().length === this.textContent.length) {
      // 在下一个事件循环中更新值，确保DOM已更新
      setTimeout(() => this._updateValueFromContent(), 0);
    }
  }

  /**
 * 处理DOM变化
 */
  _handleMutations(mutations) {
    // 避免在更新过程中触发
    if (this._updating) {
      return;
    }

    // 检测是否有自定义组件的内容变化
    let componentChanged = false;

    // 优化：只检查关键变化
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      // 检查是否有自定义组件变化
      if (mutation.target.tagName &&
        mutation.target.tagName.includes('-') &&
        mutation.type !== 'attributes') {
        componentChanged = true;
        break; // 找到一个就足够了，不需要继续
      }
    }

    // 如果检测到组件变化，更新编辑器值
    if (componentChanged) {
      console.log('检测到组件DOM变化');
      this._updateValueFromContent();
    }
  }

  /**
   * 获取编辑器内容
   * 
   * @param {boolean} filterEmpty 是否过滤空值
   * @returns {string} 编辑器格式化内容
   */
  getContent(filterEmpty = true) {
    // 创建一个克隆节点以处理内容
    const clone = this.cloneNode(true);

    // 处理所有已注册的组件
    MEditor.components.forEach((config, type) => {
      const components = clone.querySelectorAll(type);
      components.forEach(component => {
        const originalComponent = this.querySelector(`#${component.id}`);
        if (originalComponent) {
          // 增加对回显组件的特殊处理 - 回显组件不应被视为空值
          const isRestoreComponent = originalComponent.classList.contains('is-restore') ||
            (originalComponent._data && originalComponent._data.isRestore) ||
            (originalComponent._config && originalComponent._config.isRestore);

          // 对回显组件特殊处理 - 始终视为有效值
          const hasValue = isRestoreComponent ||
            (originalComponent.hasValidValue && originalComponent.hasValidValue());

          if (filterEmpty && !hasValue) {
            component.remove();
          } else {
            const fullValue = originalComponent.getFullValue();
            // 确保值不为undefined
            const textNode = document.createTextNode(fullValue || '');
            component.replaceWith(textNode);
          }
        }
      });
    });

    // 优化空格处理，标签之间只保留一个空格
    let content = clone.textContent;
    content = content.replace(/\s+/g, ' ').trim();

    return content;
  }

  /**
   * 获取原始内容
   * @returns {string} 编辑器原始HTML内容
   */
  getRawContent() {
    return this.innerHTML;
  }

  /**
   * 确保编辑器已获得焦点且有内容
   * 重写原生focus方法，增强其功能
   */
  focus() {
    // 调用原生focus
    super.focus();

    // 如果编辑器是空的，创建一个初始段落
    if (!this.textContent.trim()) {
      const p = document.createElement('p');
      // 分开设置样式，而不是在创建时设置
      p.style.margin = '0';
      p.style.display = 'inline-block';
      p.innerHTML = '&nbsp;';  // 使用空格确保段落有高度
      this.appendChild(p);

      // 将光标移到段落开始处
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(p, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // 修改部分：当编辑器已有内容时，将光标移到末尾
      const range = document.createRange();
      const sel = window.getSelection();

      // 获取最后一个子节点
      const lastChild = this.lastChild;

      if (lastChild) {
        if (lastChild.nodeType === Node.TEXT_NODE) {
          // 如果是文本节点，将光标放在文本末尾
          range.setStart(lastChild, lastChild.length);
        } else {
          // 如果是元素节点，将光标放在元素后面
          range.setStartAfter(lastChild);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    return this;
  }

  /**
 * 在当前光标位置插入块
 * @param {string} type 组件类型
 * @param {Object} data 组件数据 - value和displayText可以是函数
 * @param {Object} config 组件配置
 */
  insertBlock(type, data = {}, config = {}) {
    try {
      // 先确保编辑器聚焦
      this.focus();

      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);

      // 获取注册的组件配置
      const componentConfig = MEditor.getComponent(type);
      if (!componentConfig || !componentConfig.constructor) {
        console.error(`Component type "${type}" not registered`);
        return;
      }

      // 创建组件实例 - 使用文档片段来避免直接操作DOM
      const fragment = document.createDocumentFragment();
      const block = new componentConfig.constructor();

      // 设置唯一ID
      const blockId = `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      block.id = blockId;

      // 合并默认配置和自定义配置
      const mergedConfig = {
        ...componentConfig.defaultConfig,
        ...config
      };

      // 设置组件配置
      if (block.setConfig) {
        block.setConfig(mergedConfig);
      }

      // 设置组件是否可点击
      if (mergedConfig.hasOwnProperty('clickable') && block.setClickable) {
        block.setClickable(mergedConfig.clickable);
      }

      // 设置前缀（如果提供）
      if (mergedConfig.prefix) {
        block.setPrefix(mergedConfig.prefix);
      }

      // 设置模板（如果提供）
      if (config.template) {
        block.setTemplate(config.template);
      } else if (componentConfig.defaultConfig && componentConfig.defaultConfig.template) {
        block.setTemplate(componentConfig.defaultConfig.template);
      }


      // 处理可能是函数类型的数据
      const processedData = { ...data };
      const value_key = mergedConfig.value_key || 'code';

      // 处理value可能是函数的情况
      if (typeof data.value === 'function') {
        try {
          // 执行函数获取实际值
          processedData.value = data.value(block, mergedConfig);

          // 确保selectedItem也包含该值
          if (!processedData.selectedItem) {
            processedData.selectedItem = { [value_key]: processedData.value, code: processedData.value };
          } else if (typeof processedData.selectedItem === 'object') {
            processedData.selectedItem[value_key] = processedData.value;
            processedData.selectedItem.code = processedData.value;
          }
        } catch (error) {
          console.error('执行value函数时出错:', error);
          processedData.value = data.value !== undefined ? data.value : null;
        }
      }

      // 处理displayText可能是函数的情况
      if (typeof data.displayText === 'function') {
        try {
          // 执行函数获取显示文本
          processedData.displayText = data.displayText(processedData.value, block, mergedConfig);
        } catch (error) {
          console.error('执行displayText函数时出错:', error);
          // 保持原有displayText或使用默认值
        }
      }

      // 设置初始数据 - 确保空值使用null处理，这样将触发<<NULL>>替换

      if (block.setData) {
        const finalData = {
          id: blockId,
          // 使用处理后的值，如果未定义则为null
          value: processedData.value !== undefined ? processedData.value : null,
          ...processedData
        };

        // 确保selectedItem包含code值
        if (finalData.value && (!finalData.selectedItem || typeof finalData.selectedItem !== 'object')) {
          finalData.selectedItem = { [value_key]: finalData.value, code: finalData.value };
        } else if (finalData.value && finalData.selectedItem && typeof finalData.selectedItem === 'object') {
          finalData.selectedItem[value_key] = finalData.value;
          finalData.selectedItem.code = finalData.value;
        }

        block.setData(finalData);
      }

      // 添加到文档片段
      fragment.appendChild(block);

      // 添加空格
      const space = document.createTextNode('\u00A0');
      fragment.appendChild(space);

      // 一次性插入片段
      range.deleteContents();
      range.insertNode(fragment);

      // 设置光标位置
      range.setStartAfter(space);
      range.setEndAfter(space);
      selection.removeAllRanges();
      selection.addRange(range);

      // 插入组件后检查并更新占位符状态
      this._checkPlaceholder();

      // 立即触发更新，确保组件渲染完成后的值能同步更新
      this._updateComponentValue(blockId);

      return block;
    } catch (err) {
      console.error('插入块时出错:', err);
      return null;
    }
  }

  /**
   * 更新插入组件后的值
   * @private
   */
  _updateComponentValue(blockId) {
    // 立即尝试一次更新
    this._updateValueFromContent();

    // 然后确保组件完全渋染后再次更新
    setTimeout(() => {
      // 确保组件已经存在并可访问
      const insertedComponent = this.querySelector(`#${blockId}`);
      if (insertedComponent) {
        // 强制更新组件状态（如果组件支持）
        if (typeof insertedComponent._render === 'function') {
          insertedComponent._render();
        }
      }

      // 再次更新数据值并触发事件，确保捕获组件渲染完成后的值
      this._updateValueFromContent();
    }, 16);
  }

  /**
   * 从编辑器内容更新值
   * @private
   */
  _updateValueFromContent() {
    // 防止递归调用
    if (this._updating) {
      console.log('避免递归更新');
      return;
    }

    // 防抖机制：清除之前的计时器
    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
      this._updateTimer = null;
    }

    // 使用防抖动计时器，避免频繁更新
    this._updateTimer = setTimeout(() => {
      try {
        // 设置更新标志
        this._updating = true;
        console.log('开始更新值');

        // 检查回显组件
        const restoreComponents = Array.from(this.querySelectorAll('[id^="block-"]')).filter(comp => {
          // 检查是否是回显组件
          return comp._data && comp._data.isRestore ||
            comp._config && comp._config.isRestore ||
            comp.classList.contains('is-restore');
        });

        const hasRestoreComponents = restoreComponents.length > 0;

        // 获取新内容时考虑回显组件
        const newValue = this.getContent(false);

        // 检查值是否真的改变了，避免不必要的更新
        if (this._value === newValue) {
          console.log('值未变化，跳过更新');
          return;
        }

        // 特殊处理回显组件：如果新值包含NULL但有回显组件存在，可能是回显组件值被错误重置
        if ((this._isRestoring || hasRestoreComponents) &&
          (newValue.includes('<<NULL>>') || !newValue)) {
          console.log('回显过程中检测到无效值，跳过更新');

          // 修复回显组件的值，避免被重置为NULL
          if (hasRestoreComponents) {
            restoreComponents.forEach(comp => {
              // 检查组件值是否已变为NULL
              const data = comp._data || {};
              if (data.value === '<<NULL>>' && typeof comp.setRestoreStatus === 'function') {
                console.log('修复回显组件值');
                // 重新标记为回显组件，确保在后续操作中正确处理
                comp.setRestoreStatus(true);
              }
            });
          }
          return;
        }

        // 更新内部值
        this._value = newValue;

        // 更新attribute，但避免循环
        if (this.getAttribute('value') !== newValue) {
          // 使用setAttribute而非property，避免可能的循环
          this.setAttribute('value', newValue);
        }

        // 触发change事件
        this.dispatchEvent(new CustomEvent('change', {
          bubbles: false, // 改为不冒泡，减少事件传播
          detail: { value: newValue }
        }));

        // 在回显过程中，避免触发input事件
        if (!this._isRestoring) {
          // 触发标准input事件，这对Vue的@input绑定至关重要
          // 创建新的input事件
          const inputEvent = new Event('input', {
            bubbles: true, // 需要冒泡以支持Vue绑定
            cancelable: true
          });

          // 设置target.value属性以兼容Vue的事件处理
          Object.defineProperty(inputEvent, 'target', {
            writable: false,
            value: {
              value: newValue,
              // 确保其他可能需要的属性也存在
              getAttribute: (name) => name === 'value' ? newValue : this.getAttribute(name)
            }
          });

          // 记录更新值，方便调试
          console.log('更新值:', newValue);

          // 调度输入事件
          this.dispatchEvent(inputEvent);
        } else {
          console.log('回显中，跳过input事件触发');
        }
      } finally {
        // 延迟重置更新标志，确保其他事件处理完成
        setTimeout(() => {
          this._updating = false;
          console.log('更新完成，重置标志');
        }, 50);
      }
    }, 116); // 116ms防抖动延迟
  }

  /**
   * 清理空节点
   * 删除编辑器中的空段落、空div等标签
   */
  _cleanEmptyNodes() {
    // 递归遍历所有节点
    const walker = document.createTreeWalker(
      this,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    const nodesToRemove = [];
    let currentNode;

    // 收集所有空节点
    while (currentNode = walker.nextNode()) {
      // 跳过自定义组件
      if (currentNode !== this && currentNode.tagName && currentNode.tagName.includes('-')) {
        continue;
      }

      // 检查元素是否为空（只有空白字符或不包含任何文本内容）
      const textContent = currentNode.textContent.trim();
      const onlyHasBreak = currentNode.innerHTML.trim() === '<br>' || currentNode.innerHTML.trim() === '&nbsp;';
      const onlyHasSpace = !textContent && currentNode.innerHTML.trim() === '';

      if ((onlyHasBreak || onlyHasSpace) &&
        currentNode.childNodes.length <= 1 &&
        !currentNode.querySelector('video, audio, iframe, canvas')) {
        nodesToRemove.push(currentNode);
      }
    }

    // 移除收集到的空节点
    nodesToRemove.forEach(node => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  /**
   * 观察属性变化
   */
  static get observedAttributes() {
    return ['disabled', 'value'];
  }

  /**
   * 当观察的属性变化时调用
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'disabled') {
      this._updateDisabledState();
    } else if (name === 'value' && oldValue !== newValue) {
      // 避免循环更新
      if (this._value !== newValue) {
        this.setValue(newValue || '');
      }
    }
  }

  /**
   * 更新禁用状态
   * @private
   */
  _updateDisabledState() {
    const isDisabled = this.hasAttribute('disabled');

    // 更新contenteditable属性
    this.setAttribute('contenteditable', isDisabled ? 'false' : 'true');

    // 更新样式类
    if (isDisabled) {
      this.classList.add('disabled');
      if (this._clearButton) {
        this._clearButton.style.display = 'none';
      }
    } else {
      this.classList.remove('.disabled');
      if (this._clearButton) {
        this._clearButton.style.display = '';
      }
    }
  }

  /**
   * 获取禁用状态
   */
  get disabled() {
    return this.hasAttribute('disabled');
  }

  /**
   * 设置禁用状态
   */
  set disabled(value) {
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  /**
   * 获取编辑器值
   */
  get value() {
    return this._value;
  }

  /**
   * 设置编辑器值
   */
  set value(newValue) {
    if (this._value !== newValue) {
      this.setValue(newValue);
    }
  }

  /**
   * 设置编辑器内容
   * @param {string} value 新内容
   * @returns {MEditor} 编辑器实例，支持链式调用
   */
  setValue(value) {
    if (this._value === value) return this;

    // 防止递归
    if (this._updating) return this;

    try {
      this._updating = true;
      this._value = value;

      // 如果未初始化，延迟设置
      if (!this._initialized) {
        this.onReady(() => {
          this.innerHTML = value || '';
          this._checkPlaceholder();
        });
      } else {
        this.innerHTML = value || '';
        this._checkPlaceholder();
      }

      // 触发change事件
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        detail: { value }
      }));
    } finally {
      setTimeout(() => {
        this._updating = false;
      }, 0);
    }

    return this;
  }

  /**
   * 在光标位置追加文本
   * @param {string} text 要追加的文本
   * @param {string} position 追加位置，'before' 或 'after'（默认）
   * @returns {MEditor} 编辑器实例，支持链式调用
   */
  appendText(text, position = 'after') {
    if (!text || this.disabled) return this;

    // 获取当前选区
    const selection = window.getSelection();

    // 检查是否存在选区以及选区是否在编辑器内
    const isRangeInEditor = selection.rangeCount > 0 &&
      (this.contains(selection.getRangeAt(0).commonAncestorContainer) ||
        this === selection.getRangeAt(0).commonAncestorContainer);

    if (!selection.rangeCount || !isRangeInEditor) {
      // 如果没有选区或选区不在编辑器内，聚焦编辑器并将文本追加到末尾
      this.focus();
      // 获取新的选区 (focus方法已确保编辑器内有内容并设置了焦点)
      selection.removeAllRanges();
      const range = document.createRange();
      // 移动到编辑器内容末尾
      const lastChild = this.lastChild;
      if (lastChild) {
        if (lastChild.nodeType === Node.TEXT_NODE) {
          range.setStart(lastChild, lastChild.length);
        } else {
          range.setStartAfter(lastChild);
        }
        range.collapse(true);
        selection.addRange(range);
      }
    }

    const range = selection.getRangeAt(0);

    // 根据位置确定插入点
    if (position === 'before') {
      range.setEnd(range.startContainer, range.startOffset);
      range.collapse(true);
    } else {
      range.setStart(range.endContainer, range.endOffset);
      range.collapse(false);
    }

    // 插入文本
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // 移动光标到插入文本后
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // 更新值
    this._updateValueFromContent();

    return this;
  }

  /**
   * 解析混合内容，将组件标记部分转换为实际组件
   * @param {string} content 包含组件标记的混合内容
   * @param {Object} options 解析配置选项
   * @param {boolean} options.onlyComponents 是否仅返回识别的组件
   * @param {boolean} options.preserveStructure 是否保留原始文本结构
   * @param {Array} options.componentPatterns 自定义组件匹配模式
   * @returns {string|HTMLElement} 处理后的HTML内容或DOM元素
   */
  parseContentWithComponents(content, options = {}) {
    if (!content) return '';

    const defaultOptions = {
      onlyComponents: false,    // 是否只返回识别的组件
      preserveStructure: true,  // 是否保留原始文本结构
      componentPatterns: []     // 自定义组件匹配模式数组
    };

    // 合并选项
    const opts = { ...defaultOptions, ...options };

    // 临时存储结果的容器
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);

    try {
      // 处理内容，将识别到的组件转换为HTML
      const processedContent = this._processPastedText(content);
      tempContainer.innerHTML = processedContent;

      // 如果只需要组件，则过滤掉纯文本节点
      if (opts.onlyComponents) {
        const components = Array.from(tempContainer.querySelectorAll('[id^="block-"]'));

        // 清空容器
        tempContainer.innerHTML = '';

        // 重新添加组件
        components.forEach(comp => {
          tempContainer.appendChild(comp);
        });
      }

      // 返回HTML字符串或DOM节点
      const result = opts.preserveStructure ? tempContainer.innerHTML : tempContainer;
      return result;
    } catch (err) {
      console.error('解析组件内容时出错:', err);
      return content; // 出错时返回原始内容
    } finally {
      // 清理临时容器
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * 重置处理过的内容，用于防止多次调用导致的重复解析
   * @private
   */
  _resetProcessedContent() {
    // 清除所有带有恢复标记的组件
    const restoreComponents = this.querySelectorAll('[id^="block-"]');
    restoreComponents.forEach(comp => {
      // 检查是否是回显组件
      if (comp._data && comp._data.isRestore) {
        // 清除isRestore标记，避免下次重复解析
        comp._data.isRestore = false;
        if (comp._config) {
          comp._config.isRestore = false;
        }
      }
    });
  }

  /**
   * 简化版设置带组件的混合内容
   * @param {string} content 包含组件标记的混合内容
   * @returns {MEditor} 编辑器实例，支持链式调用
   */
  setContentWithComponents(content, options = {}) {
    if (!content) {
      return this.setValue('');
    }

    const self = this;

    // 确保编辑器已初始化
    if (!this._initialized) {
      return this.onReady(() => {
        self._setContentWithComponentsSimple(content, options);
      });
    }

    this._setContentWithComponentsSimple(content, options);
    return this;
  }

  /**
   * 内容处理实现
   * @private
   */
  _setContentWithComponentsSimple(content, predefinedParams = {}) {
    try {
      // 设置防止递归更新的标志
      this._isRestoring = true;
      this._updating = true;
  
      // 清空当前内容
      this.innerHTML = '';
  
      // 匹配所有花括号格式的组件代码 {PREFIX-CODE}
      const componentPattern = /\{([A-Z0-9]+-[A-Z0-9]+-[^}]+)\}/g;
      let match;
      let lastIndex = 0;
      const fragments = [];
  
      // 查找所有匹配
      while ((match = componentPattern.exec(content)) !== null) {
        const fullMatch = match[0]; // 完整匹配，如 {TLJ-PLLJ-1iTgI9}
        const codeWithPrefix = match[1]; // 带前缀的代码，如 TLJ-PLLJ-1iTgI9
  
        // 添加匹配前的文本
        if (match.index > lastIndex) {
          fragments.push(document.createTextNode(
            content.substring(lastIndex, match.index)
          ));
        }
  
        // 尝试查找匹配的组件类型
        let matchedComponent = false;
  
        // 检查所有注册的组件
        for (const [type, config] of MEditor.components.entries()) {
          if (!config.prefix) continue;
  
          // 检查是否匹配当前组件前缀
          if (codeWithPrefix.startsWith(config.prefix)) {
            // 提取不带前缀的代码部分
            const code = codeWithPrefix.substring(config.prefix.length).replace(/^[-_]/, '');
  
            // 创建组件实例
            const component = new config.constructor();
            component.id = `block-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
            // 重要：先应用预定义参数到组件配置
            const componentConfig = {
              ...config.defaultConfig,
              ...predefinedParams, // 合并预定义参数
              isRestore: true      // 回显组件标记
            };
            component.setConfig(componentConfig);
  
            // 设置前缀
            if (config.prefix) {
              component.setPrefix(config.prefix);
            }
  
            // 特别处理clickable参数
            if (predefinedParams.hasOwnProperty('clickable') && 
                typeof component.setClickable === 'function') {
              component.setClickable(!!predefinedParams.clickable);
            }
  
            // 设置为回显组件并显示原始格式
            if (typeof component.setAsRestoreComponent === 'function') {
              component.setAsRestoreComponent(fullMatch);
            }
  
            // 设置代码值(这样getContent可以正确获取值)
            component.setData({ value: code });
  
            // 将组件添加到结果中
            fragments.push(component);
            matchedComponent = true;
            break;
          }
        }
  
        // 如果没有匹配的组件，保留原始文本
        if (!matchedComponent) {
          fragments.push(document.createTextNode(fullMatch));
        }
  
        lastIndex = match.index + fullMatch.length;
      }
  
      // 添加剩余文本
      if (lastIndex < content.length) {
        fragments.push(document.createTextNode(
          content.substring(lastIndex)
        ));
      }
  
      // 将所有片段添加到编辑器
      fragments.forEach(fragment => this.appendChild(fragment));
  
      // 保存原始值并更新
      this._value = content;
      this.setAttribute('value', content);
  
      // 检查占位符
      this._checkPlaceholder();
  
      // 触发change事件
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: false,
        detail: { 
          value: content,
          predefinedParams: predefinedParams 
        }
      }));
    } catch (err) {
      console.error('设置带组件内容时出错:', err);
      // 出错时使用普通文本设置
      this.setValue(content);
    } finally {
      // 重置标志
      setTimeout(() => {
        this._isRestoring = false;
        this._updating = false;
      }, 100);
    }
  }
}

// 注册组件
customElements.define('m-editor', MEditor);

