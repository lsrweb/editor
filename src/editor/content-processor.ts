/**
 * 内容处理模块
 */
export class ContentProcessor {
  static methods = {
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
    },

    /**
     * 处理粘贴文本，识别并转换优惠券格式
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

        this.constructor.components.forEach((config, type) => {
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

      // 处理特殊格式和剩余文本
      if (lastIndex < text.length) {
        const remaining = text.substring(lastIndex);
        const specialFormatResult = this._processSpecialFormat(remaining, isRestore);

        if (specialFormatResult.modified) {
          fragments.push(specialFormatResult.content);
          modified = true;
        } else {
          // 如果特殊格式处理没有发生变化，处理标准格式
          const standardResult = this._processStandardFormat(remaining, isRestore);
          fragments.push(standardResult.content);
          if (standardResult.modified) {
            modified = true;
          }
        }
      }

      const result = modified ? fragments.join('') : text;
      console.log('处理后的内容:', result);
      return result;
    },

    /**
     * 处理特殊格式 - 例如 {@昵称}1212{TLJ-PLLJ-1iTgI9}
     */
    _processSpecialFormat(text, isRestore) {
      // 此正则模式捕获花括号格式的代码
      const specialFormat = /(\{@[^}]+\}.*?)(\{([A-Z0-9]+-[A-Z0-9]+-[^}]+)\})/g;
      
      return this._processFormatWithRegex(text, specialFormat, isRestore);
    },

    /**
     * 处理标准格式的组件
     */
    _processStandardFormat(text, isRestore) {
      const fragments = [];
      let lastIndex = 0;
      let modified = false;

      // 对每个组件类型定义通用的匹配规则
      this.constructor.components.forEach((config, type) => {
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
    },

    /**
     * 使用指定的正则表达式处理文本格式
     * @private
     */
    _processFormatWithRegex(text, regex, isRestore) {
      const fragments = [];
      let lastIndex = 0;
      let modified = false;

      let match;
      // 重置正则的lastIndex，确保从头开始匹配
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];            // 完整匹配
        const beforePart = match[1];           // {@昵称}1212
        const bracketedCode = match[2];        // {TLJ-PLLJ-1iTgI9}
        const codeWithPrefix = match[3];       // TLJ-PLLJ-1iTgI9

        const startPos = match.index;
        const endPos = startPos + fullMatch.length;

        // 将前面未处理的文本添加到结果
        if (startPos > lastIndex) {
          fragments.push(text.substring(lastIndex, startPos));
        }

        // 尝试识别代码属于哪个组件
        let matchedComponent = false;
        this.constructor.components.forEach((config, type) => {
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
    },

    /**
     * 获取组件类型的匹配模式
     */
    _getMatchPatterns(type, escapedPrefix) {
      // 获取组件配置
      const componentConfig = this.constructor.getComponent(type);
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
    },

    /**
     * 从模板创建匹配模式
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
    },

    /**
     * 创建优惠券组件
     */
    _createCouponComponent(type, code, isRestore = false, extraData = {}) {
      const componentConfig = this.constructor.getComponent(type);
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
      let displayText = '';
      const originalFormat = extraData.originalFormat || '';

      if (isRestore && originalFormat) {
        displayText = originalFormat;
      } else if (isRestore) {
        displayText = (type.includes('taobao') ? '淘宝礼金: ' : '京东礼金: ') + code;
      } else {
        displayText = mergedConfig.default_text || (type.includes('taobao') ? '淘宝礼金' : '京东礼金');
      }

      // 标记回显组件
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

      // 设置组件数据
      component.setData(componentData);

      // 明确调用setRestoreStatus方法设置回显状态
      if (isRestore && typeof component.setRestoreStatus === 'function') {
        component.setRestoreStatus(true);
      }

      return component;
    },
    
    /**
     * 获取编辑器内容
     */
    getContent(filterEmpty = true) {
      // 创建一个克隆节点以处理内容
      const clone = this.cloneNode(true);

      // 处理所有已注册的组件
      this.constructor.components.forEach((config, type) => {
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
    },
    
    /**
     * 从编辑器内容更新值
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
            return;
          }

          // 特殊处理回显组件
          if ((this._isRestoring || hasRestoreComponents) &&
            (newValue.includes('<<NULL>>') || !newValue)) {
            // 修复回显组件的值，避免被重置为NULL
            if (hasRestoreComponents) {
              restoreComponents.forEach(comp => {
                // 检查组件值是否已变为NULL
                const data = comp._data || {};
                if (data.value === '<<NULL>>' && typeof comp.setRestoreStatus === 'function') {
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
            // 触发标准input事件
            const inputEvent = new Event('input', {
              bubbles: true, // 需要冒泡以支持Vue绑定
              cancelable: true
            });

            // 设置target.value属性以兼容Vue的事件处理
            Object.defineProperty(inputEvent, 'target', {
              writable: false,
              value: {
                value: newValue,
                getAttribute: (name) => name === 'value' ? newValue : this.getAttribute(name)
              }
            });

            // 调度输入事件
            this.dispatchEvent(inputEvent);
          }
        } finally {
          // 延迟重置更新标志，确保其他事件处理完成
          setTimeout(() => {
            this._updating = false;
          }, 50);
        }
      }, 100); // 100ms防抖动延迟
    },
    
    /**
     * 设置编辑器内容
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
    },
    
    /**
     * 简化版设置带组件的混合内容
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
    },
    
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
          for (const [type, config] of this.constructor.components.entries()) {
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
      
              // 设置代码值
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
    },

    /**
     * 在光标位置插入组件块
     * @param type 组件类型
     * @param data 组件数据 - value和displayText可以是函数
     * @param config 组件配置
     */
    insertBlock(type, data = {}, config = {}) {
      try {
        // 先确保编辑器聚焦
        this.focus();

        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);

        // 获取注册的组件配置
        const componentConfig = this.constructor.getComponent(type);
        if (!componentConfig || !componentConfig.constructor) {
          console.error(`Component type "${type}" not registered`);
          return null;
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
    },

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
    },

    /**
     * 解析混合内容，将组件标记部分转换为实际组件
     * @param content 包含组件标记的混合内容
     * @param options 解析配置选项
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
    },
    
    /**
     * 清除编辑器所有内容
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
    },
    
    /**
     * 在光标位置追加文本
     * @param text 要追加的文本
     * @param position 追加位置，'before' 或 'after'（默认）
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
    },
    
    /**
     * 确保编辑器已获得焦点且有内容
     * 重写原生focus方法，增强其功能
     */
    focus() {
      // 调用原生focus - 修复这里不能使用super.focus()的问题
      HTMLElement.prototype.focus.call(this);

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
        // 当编辑器已有内容时，将光标移到末尾
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
  };
}
