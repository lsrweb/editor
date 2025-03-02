/**
 * 基础块组件
 * 为所有自定义块提供公共功能
 */
class MBlock extends HTMLElement {
    // 添加静态属性和方法
    static register(editor) {
        editor.registerComponent(this.tagName.toLowerCase(), {
            constructor: this,
            prefix: this.prefix || ''
        });
    }

    /**
     * 检测是否为Vue环境
     */
    static isVueEnvironment() {
        return typeof window !== 'undefined' && typeof window.Vue !== 'undefined';
    }

    constructor() {
        super();

        // 不在构造函数中处理DOM和属性
        this._data = {};
        this._prefix = ''; // 添加前缀属性
        this._template = '${prefix}_${value}'; // 默认模板
        this._config = {
            label_key: 'name',   // 默认标签键
            value_key: 'code',   // 默认值键
            icon_url: '',        // 图标URL，为空则使用默认图标
            default_text: ''     // 默认文本
        }; // 存储组件配置

        // Vue环境检测
        this._isVueEnvironment = MBlock.isVueEnvironment();

        // 延迟初始化标志
        this._initialized = false;

        // 添加clickable属性，默认为可点击
        this._clickable = true;
    }

    connectedCallback() {
        // 在DOM连接时设置属性，而非构造函数中
        // 设置不可编辑
        this.setAttribute('contenteditable', 'false');

        // Vue环境适配
        if (this._isVueEnvironment) {
            // 标记组件不应被Vue处理
            this.setAttribute('data-vue-skip', 'true');

            // 延迟初始化确保DOM准备好
            setTimeout(() => {
                if (!this._initialized) {
                    this._initialized = true;
                    this._render();
                }
            }, 0);
        } else {
            // 非Vue环境直接初始化
            this._initialized = true;
            this._render();
        }
    }

    disconnectedCallback() {
        // 清理可能的事件监听器
    }

    /**
     * 设置组件数据
     * @param {Object} data 组件数据
     */
    setData(data) {
        this._data = { ...this._data, ...data };
        this._render();
        return this;
    }

    /**
     * 获取组件数据
     */
    getData() {
        return this._data || {};
    }

    /**
     * 获取组件前缀
     */
    getPrefix() {
        return this._prefix;
    }

    /**
     * 设置组件前缀
     */
    setPrefix(prefix) {
        this._prefix = prefix;
        return this;
    }

    /**
     * 设置组件配置
     * @param {Object} config 配置对象
     */
    setConfig(config) {
        this._config = { ...this._config, ...config };
        
        // 特别处理clickable属性
        if (config.hasOwnProperty('clickable')) {
            this._clickable = !!config.clickable;
        }
        
        return this;
    }

    /**
     * 获取组件配置
     */
    getConfig() {
        return this._config;
    }

    /**
     * 设置值模板
     */
    setTemplate(template) {
        this._template = template;
        return this;
    }

    /**
     * 使用模板生成最终值
     * @param {string} template 模板字符串，例如 "${prefix}_${value}"
     * @returns {string} 替换后的字符串
     */
    getValueWithTemplate(template) {
        const data = this.getData();
        const prefix = this.getPrefix();

        // 支持的变量列表
        const variables = {
            prefix,
            value: data.value || '<<NULL>>', // 空值标识
            id: data.id || '',
            // 添加组合变量
            'prefix+value': `${prefix}${data.value || '<<NULL>>'}`
        };

        // 先替换组合变量，再替换基础变量
        return template
            // 替换 ${xxx} 形式的变量
            .replace(/\${([^}]+)}/g, (match, key) => {
                // 支持变量组合，如 ${prefix+value}
                return variables[key] !== undefined ? variables[key] : match;
            })
            // 处理特殊字符和空格
            .trim();
    }

    /**
     * 获取完整的值（带前缀）
     * 可以被子类覆盖以使用不同的模板
     */
    getFullValue() {
        return this.getValueWithTemplate(this._template);
    }

    /**
     * 渲染组件
     * 子类需要重写此方法
     */
    _render() {
        try {
            if (!this._initialized) return; // 确保已初始化

            // 默认实现
            const data = this.getData();

            // 使用自定义方式渲染而非直接赋值
            this._safeRender(() => {
                // 使用textContent而不是innerHTML来避免潜在的Vue兼容性问题
                this.textContent = data.value || '未设置内容';
            });
        } catch (err) {
            console.error('渲染组件时出错:', err);
            this.textContent = '渲染错误';
        }
    }

    /**
     * 安全渲染方法
     * 包装渲染操作，确保与Vue的兼容性
     */
    _safeRender(renderFn) {
        if (this._isVueEnvironment) {
            // 在Vue环境中，暂时移除数据响应式监听
            const vueInstance = this.__vue__;
            if (vueInstance && vueInstance.$parent) {
                // 尝试临时停止Vue的监听
                try {
                    renderFn();
                } catch (e) {
                    console.error('Vue环境渲染错误:', e);
                    // 降级处理
                    setTimeout(renderFn, 0);
                }
            } else {
                // 没有直接关联的Vue实例，使用延迟处理
                setTimeout(renderFn, 0);
            }
        } else {
            // 非Vue环境，直接执行渲染
            renderFn();
        }
    }

    /**
     * 判断组件是否有有效值
     * 子类可以重写此方法
     */
    hasValidValue() {
        const data = this.getData();
        return !!data.value;
    }

    /**
     * 设置组件是否可点击
     * @param {boolean} clickable 是否可点击
     */
    setClickable(clickable) {
        this._clickable = !!clickable;
        return this;
    }

    /**
     * 获取组件是否可点击
     * @returns {boolean} 是否可点击
     */
    isClickable() {
        return this._clickable;
    }

    /**
     * 判断是否为emoji或图片,根据码点判断
     * 方法废弃,网上找到的方法不对
     */
    // isEmojiOrImage(iconUrl) {
    //     if (!iconUrl) {
    //         return false;
    //     }

    //     // 判断是否为emoji
    //     if (iconUrl.length === 1) {
    //         const code = iconUrl.charCodeAt(0);
    //         return (code >= 0x1f600 && code <= 0x1f64f) ||
    //             (code >= 0x1f300 && code <= 0x1f5ff) ||
    //             (code >= 0x1f680 && code <= 0x1f6ff) ||
    //             (code >= 0x1f900 && code <= 0x1f9ff);
    //     }

    //     return true;
    // }
}

// 注册组件
customElements.define('m-block', MBlock);
