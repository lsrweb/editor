/**
 * 京东礼金组件
 */
class JDCoupon extends MBlock {
    static tagName = 'jd-coupon';
    static prefix = 'JDLJ-PLLJ';  // 移除末尾的连字符，让模板来控制

    constructor() {
        super();
        this.classList.add('jd-coupon');
        this.setPrefix(JDCoupon.prefix);
        // 设置默认模板
        this.setTemplate('{${prefix+value}}');
    }
    
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('click', this._handleClick.bind(this));
    }
    
    _handleClick(event) {
        // 阻止冒泡，以便编辑器不会失去焦点
        event.stopPropagation();
        
        // 触发自定义点击事件，让外部决定如何处理弹窗
        const clickEvent = new CustomEvent('coupon-click', {
            bubbles: true,
            detail: {
                type: 'jd',
                data: this.getData(),
                // 提供更新方法的引用，让外部可以调用
                updateCoupon: (selectedValue) => this._updateCouponData(selectedValue)
            }
        });
        this.dispatchEvent(clickEvent);
    }
    
    /**
     * 更新优惠券数据
     * @param {Object} selectedValue 选择的优惠券数据
     */
    _updateCouponData(selectedValue) {
        if (selectedValue) {
            const currentData = this.getData();
            // 更新组件数据
            this.setData({
                ...currentData,
                value: selectedValue.code,
                displayText: selectedValue.name || '京东礼金',
                selectedItem: selectedValue
            });
            
            // 触发数据更新事件，通知编辑器组件已更新
            const updateEvent = new CustomEvent('component-updated', {
                bubbles: true,
                detail: {
                    id: this.id,
                    type: 'jd',
                    data: this.getData()
                }
            });
            this.dispatchEvent(updateEvent);
        }
    }
    
    /**
     * 自定义渲染方法
     */
    _render() {
        const data = this.getData();
        const displayText = data.displayText || '京东礼金';
        
        this.innerHTML = `
            <div class="block-content jd-style">
                <span class="block-icon">🏷️</span>
                <span class="block-label">${displayText}</span>
            </div>
        `;
    }
    
    /**
     * 获取组件数据
     */
    getData() {
        const data = super.getData();
        if (data.selectedItem) {
            // 确保只返回 code 值，去掉可能包含的前缀
            const code = data.selectedItem.code.replace(/^JDLJ-PLLJ-/, '');
            return {
                ...data,
                value: code
            };
        }
        
        // 未选择时返回空值标识
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
        return data.selectedItem !== undefined && data.value;
    }

    /**
     * 覆盖获取完整值的方法，使用实例模板
     */
    getFullValue() {
        // 使用实例的模板 this._template，而不是硬编码的模板
        return this.getValueWithTemplate(this._template);
    }
}

// 注册组件
customElements.define(JDCoupon.tagName, JDCoupon);
// 注册到编辑器
JDCoupon.register(MEditor);
