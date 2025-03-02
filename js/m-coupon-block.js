/**
 * 优惠券基础组件
 * 为所有优惠券类型提供通用功能
 */
class MCouponBlock extends MBlock {
    constructor() {
        super();

        // 设置默认模板
        this.setTemplate('{${prefix+value}}');

        // 默认配置
        this._config.default_type = '优惠券'; // 默认类型名称
        this._config.clickable = true; // 默认可点击
    }

    connectedCallback() {
        super.connectedCallback();
        
        // 根据clickable参数决定是否添加点击事件监听器
        if (this._clickable) {
            this.addEventListener('click', this._handleClick.bind(this));
        } else {
            // 当不可点击时，添加一个类以便于样式区分
            this.classList.add('non-clickable');
        }
    }

    /**
     * 处理点击事件
     */
    _handleClick(event) {
        // 如果组件被设置为不可点击，直接返回
        if (!this._clickable) return;

        // 阻止冒泡，以便编辑器不会失去焦点
        event.stopPropagation();

        // 获取组件类型
        const type = this.constructor.couponType || this._config.default_type;

        // 触发自定义点击事件，让外部决定如何处理弹窗
        const clickEvent = new CustomEvent('coupon-click', {
            bubbles: true,
            detail: {
                type: type,
                data: this.getData(),
                updateCoupon: (selectedValue) => this._updateCouponData(selectedValue)
            }
        });
        this.dispatchEvent(clickEvent);
    }


    /**
 * 更新优惠券数据
 * @param {Object|string|Function} selectedValue 选择的优惠券数据、字符串或函数
 */
    _updateCouponData(selectedValue) {
        if (!selectedValue) return;

        const currentData = this.getData();
        const config = this._config || {};
        const label_key = config.label_key || 'name';
        const value_key = config.value_key || 'code';
        const default_text = config.default_text || this.constructor.couponType + '优惠券';
        
        // 处理函数类型的selectedValue
        if (typeof selectedValue === 'function') {
            try {
                // 执行函数获取实际值，传入当前组件和配置
                const result = selectedValue(this, config);
                
                // 递归调用自身处理函数返回的结果
                if (result) {
                    this._updateCouponData(result);
                }
                return;
            } catch (error) {
                console.error('执行动态值函数时出错:', error);
                return; // 出错时不更新组件
            }
        }

        // 处理不同类型的输入
        if (typeof selectedValue === 'string') {
            // 直接使用字符串作为值，确保selectedItem中也包含正确的code值
            const codeValue = selectedValue;
            this.setData({
                ...currentData,
                value: codeValue,
                displayText: this._processDisplayText(default_text, codeValue, { [value_key]: codeValue }),
                selectedItem: { 
                    [value_key]: codeValue,
                    code: codeValue // 确保code值也被设置
                }
            });
        } else if (typeof selectedValue === 'object' && selectedValue !== null) {
            // 处理对象中可能存在的函数类型
            const processedValue = {};
            
            // 处理可能是函数的值
            Object.keys(selectedValue).forEach(key => {
                if (typeof selectedValue[key] === 'function') {
                    try {
                        processedValue[key] = selectedValue[key](this, config);
                    } catch (error) {
                        console.error(`执行${key}函数时出错:`, error);
                        processedValue[key] = selectedValue[key]; // 保留函数引用
                    }
                } else {
                    processedValue[key] = selectedValue[key];
                }
            });
            
            // 获取实际的值和显示文本
            const actualValue = processedValue[value_key] || processedValue.code || '';
            const displayText = processedValue[label_key] || processedValue.name || default_text;
            
            // 确保selectedItem中的code值正确设置
            if (actualValue && !processedValue.code) {
                processedValue.code = actualValue;
            }
            
            this.setData({
                ...currentData,
                value: actualValue,
                displayText: this._processDisplayText(displayText, actualValue, processedValue),
                selectedItem: processedValue
            });
        }

        // 触发数据更新事件，通知编辑器组件已更新
        const updateEvent = new CustomEvent('component-updated', {
            bubbles: true,
            detail: {
                id: this.id,
                type: this.constructor.couponType,
                data: this.getData()
            }
        });
        this.dispatchEvent(updateEvent);

        // 强制触发编辑器内容更新
        this._notifyEditorContentChanged();
    }

    /**
     * 通知编辑器内容已更改
     * 确保双向绑定的值能够更新
     */
    _notifyEditorContentChanged() {
        // 查找父编辑器组件
        let editorElement = this.closest('m-editor');
        if (editorElement) {
            // 调用编辑器的更新方法
            if (typeof editorElement._updateValueFromContent === 'function') {
                setTimeout(() => editorElement._updateValueFromContent(), 0);
            } else {
                // 如果找不到编辑器的更新方法，则触发input事件模拟内容变化
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                this.dispatchEvent(inputEvent);
            }
        }
    }

    /**
     * 处理显示文本
     * 支持用户自定义处理函数
     * @param {string} defaultText 默认文本
     * @param {string} value 优惠券值
     * @param {Object} data 完整数据对象
     * @returns {string} 处理后的显示文本
     */
    _processDisplayText(defaultText, value, data) {
        const config = this._config || {};

        // 如果配置了自定义处理函数，使用它处理显示文本
        if (config.show_process && typeof config.show_process === 'function') {
            try {
                // 准备组件配置和上下文信息
                const componentInfo = {
                    // 静态属性
                    tagName: this.constructor.tagName || 'unknown',
                    prefix: this.constructor.prefix || this.getPrefix(),
                    defaultIcon: this.constructor.defaultIcon || '🏷️',
                    styleClass: this.constructor.styleClass || 'default-style',
                    couponType: this.constructor.couponType || config.default_type || 'coupon',

                    // 实例属性
                    id: this.id,
                    template: this._template,

                    // 合并用户配置和默认配置
                    config: {
                        ...this._config
                    }
                };

                // 执行自定义处理函数，传入数据、默认文本、值和组件信息
                const processed = config.show_process(data, defaultText, value, componentInfo);

                // 如果处理函数返回有效字符串，则使用它
                if (processed && typeof processed === 'string') {
                    return processed;
                }
            } catch (err) {
                console.error('自定义显示处理函数出错:', err);
            }
        }

        // 默认情况或处理失败，返回原始文本
        return defaultText;
    }

    /**
     * 自定义渲染方法
     */
    _render() {
        const data = this.getData();
        const config = this._config || {};
        
        // 调试输出
        console.log('MCouponBlock渲染:', {
            isRestore: data.isRestore,
            configIsRestore: config.isRestore,
            hasClass: this.classList.contains('is-restore'),
            originalFormat: data.originalFormat,
            value: data.value
        });
        
        // 获取组件的前缀
        const prefix = this.getPrefix();
        
        // 使用回显特定的显示文本（如果是回显组件）
        let displayText;
        
        // 更严格地检查回显状态，优先使用originalFormat
        const isRestoreComponent = data.isRestore || config.isRestore || this.classList.contains('is-restore');
        
        if (isRestoreComponent && data.originalFormat) {
            // 使用原始格式作为显示文本
            displayText = data.originalFormat;
            console.log('使用原始格式显示:', data.originalFormat);
        } else if (isRestoreComponent && data.value) {
            // 使用标准格式化显示
            const type = this.constructor.couponType || config.default_type || '优惠券';
            displayText = `${prefix ? `{${prefix}-${data.value}}` : `${type}: ${data.value}`}`;
            console.log('使用标准格式显示:', displayText);
        } else {
            // 使用常规显示文本
            displayText = data.displayText || config.default_text || this.constructor.couponType + '优惠券';
            console.log('使用常规显示文本:', displayText);
        }

        // 判断是使用图片还是图标
        const iconClass = this.constructor.iconClass || 'default-icon';
        const defaultIcon = this.constructor.defaultIcon || '🏷️';

        const iconElement = config.icon_url
            ? `<img class="block-image" src="${config.icon_url}" alt="${displayText}">`
            : `<span class="block-icon ${iconClass}">${defaultIcon}</span>`;

        // 获取组件的CSS类名
        const styleClass = this.constructor.styleClass || 'default-style';
        
        // 根据clickable状态添加额外的类
        const clickableClass = this._clickable ? 'clickable' : 'non-clickable';
        
        // 添加回显标记类 - 确保CSS类也被添加
        const restoreClass = isRestoreComponent ? 'is-restore' : '';

        this.innerHTML = `
          <div class="block-content ${styleClass} ${clickableClass} ${restoreClass}">
            ${iconElement}
            <span class="block-label">${displayText}</span>
          </div>
        `;
        
        // 强制应用回显CSS类 - 确保样式生效
        if (isRestoreComponent) {
            this.classList.add('is-restore');
        }
    }

    /**
     * 获取组件数据
     */
    getData() {
        const data = super.getData();
        
        // 如果是回显组件，直接返回原值，避免被清理为NULL
        if (data.isRestore || this._config?.isRestore || this.classList.contains('is-restore')) {
            // 确保返回原始格式（如果有）
            return {
                ...data,
                value: data.value || '',
                // 保留原始格式
                originalFormat: data.originalFormat || (this.getPrefix() && data.value ? `{${this.getPrefix()}-${data.value}}` : undefined)
            };
        }
        
        // 确保selectedItem存在且包含code值
        if (data.selectedItem) {
            // 确保只返回 code 值，去掉可能包含的前缀
            let code = data.selectedItem.code;
            
            // 如果code存在且为字符串，尝试清理前缀
            if (typeof code === 'string') {
                // 从前缀中清除组件特定的前缀
                const prefix = this.getPrefix();
                if (prefix) {
                    // 优化前缀匹配正则，允许更灵活的分隔符
                    const prefixPattern = new RegExp(`^${prefix}[^a-zA-Z0-9]*`, 'i');
                    code = code.replace(prefixPattern, '');
                }
                
                // 确保返回的值是有效的
                return {
                    ...data,
                    value: code || data.value || '<<NULL>>'
                };
            }
            
            // 如果code不是字符串，但value是有效值，则使用value
            if (data.value && data.value !== '<<NULL>>') {
                return {
                    ...data,
                    value: data.value
                };
            }
        }

        // 检查是否存在直接设置的value，如果存在且有效则使用
        if (data.value && data.value !== '<<NULL>>') {
            return {
                ...data,
                value: data.value
            };
        }

        // 未选择或无效值时返回空值标识
        return {
            ...data,
            value: '<<NULL>>'
        };
    }

    /**
     * 检查组件是否有有效值
     */
    hasValidValue() {
        const data = this.getData();
        return data.selectedItem !== undefined && data.value && data.value !== '<<NULL>>';
    }

    /**
     * 覆盖获取完整值的方法，使用实例模板
     * 支持自定义值模板处理
     * @returns {string} 处理后的完整值
     */
    getFullValue() {
        // 获取当前配置和数据
        const config = this._config || {};
        const data = this.getData();
        
        // 如果是回显组件，确保值被正确处理
        if (data.isRestore || config.isRestore) {
            const prefix = this.getPrefix();
            const value = data.value || '';
            
            // 对于回显组件，使用更简单直接的格式返回
            if (prefix && value) {
                return `{${prefix}-${value}}`;
            }
        }
        
        // 优先使用data.value，确保它是一个有效值
        const value = (data.value && data.value !== '<<NULL>>') ? data.value : '';
        
        // 如果没有有效值，检查是否应该返回空字符串而不是模板值
        if (!value) {
            // 如果配置了空值返回空字符串，则返回空字符串
            if (config.emptyAsBlank) {
                return '';
            }
        }

        // 检查是否配置了自定义值模板处理函数
        if (config.template_value && typeof config.template_value === 'function') {
            try {
                // 准备组件配置和上下文信息
                const componentInfo = {
                    // 静态属性
                    tagName: this.constructor.tagName || 'unknown',
                    prefix: this.constructor.prefix || this.getPrefix(),
                    defaultIcon: this.constructor.defaultIcon || '🏷️',
                    styleClass: this.constructor.styleClass || 'default-style',
                    couponType: this.constructor.couponType || config.default_type || 'coupon',

                    // 实例属性
                    id: this.id,
                    template: this._template,

                    // 合并用户配置和默认配置
                    config: {
                        ...this._config
                    },
                    
                    // 添加匹配模式配置
                    matchPattern: config.matchPattern || null,
                    
                    // 添加回显标识
                    isRestore: data.isRestore || config.isRestore || false
                };

                // 将有效值注入到临时数据对象中
                const templateData = {
                    ...data,
                    value: value || '<<NULL>>' // 确保value存在，即使是空值标识
                };

                // 执行自定义模板处理函数
                // 直接返回函数的结果，不做任何额外处理
                const result = config.template_value(templateData, this._template, componentInfo);
                return result;
            } catch (err) {
                console.error('自定义值模板处理函数出错:', err);
            }
        }

        // 将有效值注入到临时数据对象中
        const templateData = {
            ...data,
            value: value || '<<NULL>>' // 确保value存在，即使是空值标识
        };
        
        // 确保实例化时设置了正确的模板
        const template = this._template || '{${prefix+value}}';
        
        // 使用修正后的数据调用getValueWithTemplate
        return this.getValueWithTemplate(template);
    }

    /**
     * 设置组件匹配模式
     * @param {Object|RegExp|string} pattern 用于识别组件的匹配模式
     * @returns {MCouponBlock} 组件实例，支持链式调用
     */
    setMatchPattern(pattern) {
        if (!this._config) this._config = {};
        this._config.matchPattern = pattern;
        return this;
    }

    /**
     * 获取组件匹配模式
     * @returns {Object|RegExp|string|null} 组件匹配模式
     */
    getMatchPattern() {
        return this._config?.matchPattern || null;
    }

    /**
     * 判断组件是否为回显组件
     * @returns {boolean} 是否为回显组件
     */
    isRestoreComponent() {
        return !!(this._data?.isRestore || this._config?.isRestore);
    }
    
    /**
     * 设置组件为回显组件
     * @param {boolean} isRestore 是否为回显组件
     * @returns {MCouponBlock} 组件实例，支持链式调用
     */
    setRestoreStatus(isRestore) {
        // 确保数据对象存在
        if (!this._data) this._data = {};
        if (!this._config) this._config = {};
        
        // 明确设置布尔值，避免隐式转换
        this._data.isRestore = Boolean(isRestore);
        this._config.isRestore = Boolean(isRestore);
        
        // 添加/移除回显标记CSS类
        if (isRestore) {
            this.classList.add('is-restore');
            console.log('设置回显状态:', this.id, '原始格式:', this._data.originalFormat);
        } else {
            this.classList.remove('is-restore');
        }
        
        // 更新渲染以反映新状态
        if (this._initialized) {
            this._render();
        }
        
        return this;
    }

    /**
     * 设置为回显模式并展示原始格式
     * @param {string} originalFormat 原始格式字符串
     * @returns {MCouponBlock} 组件实例，支持链式调用
     */
    setAsRestoreComponent(originalFormat) {
        // 确保数据和配置对象存在
        if (!this._data) this._data = {};
        if (!this._config) this._config = {};
        
        // 设置回显标志
        this._data.isRestore = true;
        this._config.isRestore = true;
        
        // 保存原始格式
        this._data.originalFormat = originalFormat;
        
        // 添加回显样式类
        this.classList.add('is-restore');
        
        // 直接修改内部HTML以显示原始格式
        const iconClass = this.constructor.iconClass || 'default-icon';
        const defaultIcon = this.constructor.defaultIcon || '🏷️';
        
        this.innerHTML = `
            <div class="block-content ${this.constructor.styleClass || 'default-style'} is-restore">
                <span class="block-icon ${iconClass}">${defaultIcon}</span>
                <span class="block-label">${originalFormat}</span>
            </div>
        `;
        
        // 标记组件已初始化
        this._initialized = true;
        
        return this;
    }
}
