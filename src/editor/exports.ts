/**
 * 主导出文件
 * 收集所有编辑器相关组件并导出
 */
import MEditorCore from './index';
import { MBlock } from './block';
import { MCouponBlock } from './coupon-block';
import { Utils } from './utils';
import { TaobaoCoupon } from './extensions/taobao-coupon';
import { JDCoupon } from './extensions/jd-coupon';

// 确保编辑器和基本组件已注册
if (typeof window !== 'undefined') {
  // 确保组件被注册
  if (!window.customElements.get('m-editor')) {
    window.customElements.define('m-editor', MEditorCore);
  }

  if (!window.customElements.get('m-block')) {
    window.customElements.define('m-block', MBlock);
  }

  if (!window.customElements.get('m-coupon-block')) {
    window.customElements.define('m-coupon-block', MCouponBlock);
  }

  // 注册扩展组件
  if (!window.customElements.get(TaobaoCoupon.tagName)) {
    window.customElements.define(TaobaoCoupon.tagName, TaobaoCoupon);
    // 自动注册到编辑器
    TaobaoCoupon.register(MEditorCore);
  }

  if (!window.customElements.get(JDCoupon.tagName)) {
    window.customElements.define(JDCoupon.tagName, JDCoupon);
    // 自动注册到编辑器
    JDCoupon.register(MEditorCore);
  }
  
  // 将编辑器导出到全局对象，解决JavaScript版组件引用问题
  (window as any).MEditor = MEditorCore;
}

// 导出所有组件
export {
  MEditorCore as MEditor, // 默认导出编辑器本身
  MBlock,
  MCouponBlock,
  TaobaoCoupon,
  JDCoupon,
  Utils,
};

// 默认导出
export default MEditorCore;
