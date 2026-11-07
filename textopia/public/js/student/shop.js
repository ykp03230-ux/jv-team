// 장터: 코인으로 캐릭터 외형(갓·댕기·한복 색…)과 집 소품(장독대·등불·병풍…)을 산다. 마을 EXP 300 에서 열린다.
import { h, once, toast, fmt } from '../ui.js';
import { houseSVG, avatarSVG } from '../art.js';
import { S, call } from './core.js';

const SLOT_LABEL = { hat: '모자', hair: '머리', outfit: '한복', acc: '손에 들 것', prop: '집 소품' };

export async function renderShop(el) {
  el.replaceChildren(h('p', { class: 'muted' }, '불러오는 중…'));
  let shop = (await call('shop/list')).shop;

  const draw = () => {
    const me = S.me;
    const groups = {};
    shop.items.forEach((i) => (groups[i.slot] ||= []).push(i));

    const row = (i) => {
      let btn;
      if (!i.owned) {
        btn = h('button', { class: 'btn small', 'data-buy': i.id, disabled: !shop.open || me.coins < i.price }, `🪙 ${i.price} 사기`);
        btn.addEventListener('click', () => once(btn, async () => {
          try { shop = (await call('shop/buy', { itemId: i.id })).shop; toast(`${i.name}을(를) 샀어요!`); draw(); } catch (e) { toast(e.message); }
        }));
      } else {
        btn = h('button', { class: 'btn small ghost', 'data-equip': i.id }, i.on ? '벗기' : '입기');
        btn.addEventListener('click', () => once(btn, async () => {
          try { shop = (await call('shop/equip', { itemId: i.id, on: !i.on })).shop; draw(); } catch (e) { toast(e.message); }
        }));
      }
      return h('div', { class: 'card row between shop-item' + (i.owned ? ' owned' : ''), 'data-item': i.id },
        h('div', { class: 'row' }, h('span', { class: 'emoji', 'aria-hidden': 'true' }, i.emoji), h('div', {}, h('strong', {}, i.name), h('div', { class: 'muted' }, i.owned ? (i.on ? '착용 중' : '가지고 있어요') : `${i.price}코인`))),
        btn);
    };

    el.replaceChildren(
      h('h2', {}, '장터'),
      shop.open
        ? h('p', { class: 'muted' }, '코인으로 내 모습과 집을 꾸며요.')
        : h('div', { class: 'card reject', id: 'market-locked' }, h('strong', {}, '장터는 아직 열리지 않았어요'), h('p', {}, `마을 EXP 가 ${fmt(shop.need)}이 되면 열려요. (지금 ${fmt(shop.villageExp)})`)),
      h('div', { class: 'card row', id: 'shop-preview' },
        h('div', { class: 'avatar-box', html: avatarSVG(me.equipped) }),
        h('div', { class: 'grow' }, h('div', { class: 'num' }, `🪙 ${fmt(me.coins)}`), h('div', { class: 'muted' }, '내 코인'))),
      h('div', { class: 'card house-card' }, h('div', { class: 'scene', html: houseSVG(me.stage.key, me.equipped) })),
      ...Object.keys(SLOT_LABEL).filter((s) => groups[s]).map((s) => h('div', { class: 'stack', style: 'margin-top:12px' }, h('h3', {}, SLOT_LABEL[s]), groups[s].map(row))),
    );
  };
  draw();
}
