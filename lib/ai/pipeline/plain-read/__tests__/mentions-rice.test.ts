import { describe, expect, it } from 'vitest';
import { mentionsRice } from '../mentions-rice';

describe('mentionsRice', () => {
  it.each([
    'a bowl of rice with teriyaki chicken',
    'Fried Rice from the takeaway',
    'cơm tấm sườn bì chả',
    '2 chén Cơm, cá kho',
    'com tam suon, 1 ly tra da',
    // Vietnamese typed in decomposed form (NFD) still reads as cơm.
    'cơm trắng 1 chén',
    'nasi lemak with extra sambal',
    'frango com arroz e feijão',
    'poulet au riz',
    'dal bhat with pickle',
    '75g basmati weighed dry, 150g chicken breast',
    '80g gạo lứt nấu lên, 1 hộp cá ngừ',
    'dolsot bibimbap with beef, no egg',
    'teishoku with gohan and miso soup',
    '공깃밥 하나랑 김치찌개',
    'ご飯 一杯と味噌汁',
    'カレーライス',
    '白米饭一碗',
    '一碗饭和红烧肉',
    '扬州炒饭',
    '김치볶음밥 1인분',
    'ข้าวสวย กับ ไข่เจียว',
  ])('finds rice in %j', (text) => {
    expect(mentionsRice(text)).toBe(true);
  });

  it.each([
    'a combo meal with fries',
    'come over for a slice of pizza',
    'a spice cake, twice',
    'low income lunch at a fair price',
    'a big comfort sandwich',
    // Unaccented "bap" is also bắp, corn.
    'bap xao bo, 1 trai bap luoc',
    'bắp xào bơ',
    // Cốm (young green rice flakes) is not cơm.
    'cốm làng Vòng',
    'a risotto-free salad with prices listed',
    'grilled salmon, broccoli and a baked potato',
    'a pot of jasmine tea with a pastry',
    // Unspaced scripts: the same letters inside another word.
    'スライスチーズ2枚とトースト',
    'オニオンスライスのサラダ',
    '치킨 케밥 1개',
    'ข้าวโพดต้ม 1 ฝัก',
    'ข้าวโอ๊ตใส่นม',
    // Meal-time words: breakfast, with no rice in it.
    '早饭 两个鸡蛋一杯牛奶',
    '朝ごはん トーストとコーヒー',
    '朝ご飯 トースト',
    '아침밥으로 토스트',
  ])('finds no rice in %j', (text) => {
    expect(mentionsRice(text)).toBe(false);
  });
});
