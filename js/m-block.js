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

    constructor() {
        super();
        this._data = {};
        this._prefix = ''; // 添加前缀属性
        this._template = '${prefix}_${value}'; // 默认模板
        this._config = {}; // 存储组件配置
    }

    connectedCallback() {
        // 默认不允许编辑
        this.contentEditable = false;
        this._render();
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
            value: data.value || '<<NULL>>', // 修改默认空值标识
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
        // 默认实现
        const data = this.getData();
        this.textContent = data.value || '未设置内容';
    }

    /**
     * 判断组件是否有有效值
     * 子类可以重写此方法
     */
    hasValidValue() {
        const data = this.getData();
        return !!data.value;
    }
}

// 注册组件
customElements.define('m-block', MBlock);
