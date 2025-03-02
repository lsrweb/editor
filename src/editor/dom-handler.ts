
/**
 * DOM操作处理模块
 */
export class DOMHandler {
  static methods = {
    /**
     * 创建清空按钮
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
    },

    /**
     * 清空内容
     */
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
    },

    /**
     * 初始化编辑器
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
    },

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
    },

    /**
     * 显示清空按钮
     */
    _showClearButton() {
      // 只有当编辑器有内容时才显示清空按钮
      if (this.textContent.trim()) {
        this._clearButton.style.visibility = 'visible';
        this._clearButton.style.opacity = '1';
      }
    },

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
    },

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
    },

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
    },

    /**
     * 清理空节点
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
    },

    /**
     * 更新禁用状态
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
  };
}
