
/**
 * 事件处理模块
 */
export class EventHandler {
  static methods = {
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
    },

    /**
     * 移除事件监听器
     */
    _removeListeners() {
      if (this._observer) {
        this._observer.disconnect();
      }
    },

    /**
     * 处理组件更新事件
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
    },

    /**
     * 处理输入事件
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
    },

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
    },

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
    },

    /**
     * 执行所有注册的onReady回调
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
    },

    /**
     * 注册一个在编辑器准备就绪时调用的回调函数
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
  };
}
