const POINTS_CONFIG = {
  CREATE_POST: 20,
  POST_REACH_10_LIKES: 50,
  POST_REACH_50_LIKES: 100,
  ADD_WARDROBE_ITEM: 5,
  ADD_5_WARDROBE_ITEMS: 25,
  COMPLETE_WEEK_PLAN: 50,
  SHARE_POST: 30,
  DAILY_LOGIN: 10,
};

const VOUCHER_THRESHOLDS = [
  {
    points: 500,
    store: 'H&M',
    amount: '$10 OFF',
    code: () => 'HM-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
  },
  {
    points: 850,
    store: 'M & S',
    amount: '15% OFF',
    code: () => 'MS-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
  },
  {
    points: 1200,
    store: 'ZARA',
    amount: '$20 OFF',
    code: () => 'ZARA-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
  },
];

module.exports = { POINTS_CONFIG, VOUCHER_THRESHOLDS };
