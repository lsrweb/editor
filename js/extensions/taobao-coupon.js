/**
 * 淘宝礼金组件
 */
class TaobaoCoupon extends MBlock {
    static tagName = 'taobao-coupon';
    static prefix = 'TLJ-PLLJ';  // 移除末尾的连字符，让模板来控制

    constructor() {
        super();
        this.classList.add('taobao-coupon');
        this.setPrefix(TaobaoCoupon.prefix);
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
                type: 'taobao',
                data: this.getData(),
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
            this.setData({
                ...currentData,
                value: selectedValue.code,
                displayText: selectedValue.name || '淘宝礼金',
                selectedItem: selectedValue
            });
            
            // 触发数据更新事件，通知编辑器组件已更新
            const updateEvent = new CustomEvent('component-updated', {
                bubbles: true,
                detail: {
                    id: this.id,
                    type: 'taobao',
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
        const displayText = data.displayText || '淘宝礼金';
        
        this.innerHTML = `
            <div class="block-content taobao-style">
                <span class="block-icon">🎁</span>
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
            const code = data.selectedItem.code.replace(/^TLJ-PLLJ-/, '');
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
customElements.define(TaobaoCoupon.tagName, TaobaoCoupon);
// 注册到编辑器
TaobaoCoupon.register(MEditor);
