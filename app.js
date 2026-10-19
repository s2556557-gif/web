/**
 * SlimFit Pro - 智能減脂塑形助手 核心邏輯引擎 (app.js)
 * 包含：SPA 多視圖路由、TDEE 計算、三餐熱量庫、168 斷食計時器、
 * HIIT 全屏訓練器、動態 SVG 體重折線圖、Web Audio 音效與海報生成
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. 全局狀態數據庫 (Reactive State Store)
     ========================================================================== */
  const defaultState = {
    theme: 'light',
    soundEnabled: true,
    notificationsEnabled: true,

    // 用戶基本生理與減脂數據 (支援自訂頭像與姓名)
    user: {
      name: '林曉晴',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
      motto: '做自己的身材雕刻家，自律即自由',
      gender: 'female',
      age: 26,
      height: 165,
      currentWeight: 58.4,
      startWeight: 64.5,
      targetWeight: 52.0,
      activity: 1.375, // 輕度活躍
      deficit: 350,    // 每日赤字 350 kcal
      streakDays: 12
    },

    // 每日預算目標
    goals: {
      targetCalorie: 1800,
      carbs: 190,
      protein: 110,
      fat: 50,
      water: 2000,
      steps: 10000
    },

    // 今日打卡動態記錄
    today: {
      water: 1500,
      steps: 7420,
      workoutBurn: 340,
      workoutMins: 42,
      meals: {
        breakfast: [
          { id: 'b1', name: '水煮蛋 (2顆)', portion: 100, kcal: 140, protein: 13, carbs: 1, fat: 10 },
          { id: 'b2', name: '全麥吐司 (1片)', portion: 60, kcal: 150, protein: 6, carbs: 28, fat: 2 },
          { id: 'b3', name: '無糖黑咖啡', portion: 250, kcal: 50, protein: 1, carbs: 2, fat: 0 }
        ],
        lunch: [
          { id: 'l1', name: '香煎雞胸肉', portion: 150, kcal: 200, protein: 38, carbs: 0, fat: 4 },
          { id: 'l2', name: '紫米飯半碗', portion: 120, kcal: 180, protein: 4, carbs: 38, fat: 1 },
          { id: 'l3', name: '清炒西蘭花', portion: 150, kcal: 110, protein: 5, carbs: 10, fat: 5 }
        ],
        dinner: [
          { id: 'd1', name: '清蒸挪威鮭魚', portion: 120, kcal: 210, protein: 24, carbs: 0, fat: 12 },
          { id: 'd2', name: '水煮花椰菜沙拉', portion: 150, kcal: 80, protein: 4, carbs: 8, fat: 3 }
        ],
        snack: []
      }
    },

    // 16:8 斷食計時器
    fasting: {
      plan: '16-8',
      targetHours: 16,
      isRunning: true,
      // 模擬在今天 14 小時 24 分鐘前開始
      startTime: Date.now() - (14 * 3600 + 24 * 60 + 38) * 1000
    },

    // 歷史體重趨勢
    weightHistory: [
      { date: '10/13', weight: 59.2, note: '挑戰第6天' },
      { date: '10/14', weight: 59.0, note: '晨起空腹' },
      { date: '10/15', weight: 58.9, note: 'HIIT運動後' },
      { date: '10/16', weight: 58.7, note: '正常少油' },
      { date: '10/17', weight: 58.6, note: '排便後測量' },
      { date: '10/18', weight: 58.5, note: '18:6斷食日' },
      { date: '10/19', weight: 58.4, note: '今日新低點' }
    ]
  };

  // 嘗試從本地 LocalStorage 載入，否則使用預設
  let state = JSON.parse(localStorage.getItem('slimfit_state_v1')) || defaultState;
  // 確保存檔支援自訂頭像、姓名與座右銘向後相容
  if (!state.user) state.user = { ...defaultState.user };
  if (!state.user.name) state.user.name = defaultState.user.name;
  if (!state.user.avatar) state.user.avatar = defaultState.user.avatar;
  if (!state.user.motto) state.user.motto = defaultState.user.motto;
  if (!state.user.height) state.user.height = defaultState.user.height;
  if (!state.user.currentWeight) state.user.currentWeight = defaultState.user.currentWeight;

  function saveState() {
    try {
      localStorage.setItem('slimfit_state_v1', JSON.stringify(state));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  /* ==========================================================================
     2. 常用食物熱量數據庫 (Food Database)
     ========================================================================== */
  const foodDatabase = [
    // 高蛋白肉蛋類
    { name: '香煎去皮雞胸肉', cat: 'protein', per100gKcal: 133, protein: 28.5, carbs: 0, fat: 2.1 },
    { name: '優質水煮土雞蛋', cat: 'protein', per100gKcal: 143, protein: 12.6, carbs: 0.8, fat: 9.5 },
    { name: '清蒸挪威頂級鮭魚', cat: 'protein', per100gKcal: 175, protein: 21.0, carbs: 0, fat: 10.2 },
    { name: '澳洲草飼菲力牛排', cat: 'protein', per100gKcal: 152, protein: 26.0, carbs: 0, fat: 5.0 },
    { name: '低脂鮮蝦白蝦', cat: 'protein', per100gKcal: 93, protein: 20.1, carbs: 0.2, fat: 0.8 },
    { name: '非基改嫩豆腐', cat: 'protein', per100gKcal: 76, protein: 8.1, carbs: 1.9, fat: 4.2 },

    // 優質主食 (低GI)
    { name: '養生紫米飯', cat: 'staple', per100gKcal: 142, protein: 3.2, carbs: 30.5, fat: 0.6 },
    { name: '全麥黑麥吐司', cat: 'staple', per100gKcal: 245, protein: 9.8, carbs: 46.0, fat: 3.2 },
    { name: '蒸甜香熟地瓜', cat: 'staple', per100gKcal: 90, protein: 1.6, carbs: 20.7, fat: 0.1 },
    { name: '即食純燕麥片', cat: 'staple', per100gKcal: 368, protein: 14.0, carbs: 62.0, fat: 6.8 },
    { name: '三色藜麥飯', cat: 'staple', per100gKcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9 },
    { name: '鮮甜嫩玉米', cat: 'staple', per100gKcal: 106, protein: 3.3, carbs: 22.8, fat: 1.2 },

    // 蔬菜菌菇
    { name: '清脆綠花椰菜', cat: 'vege', per100gKcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
    { name: '有機菠菜', cat: 'vege', per100gKcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
    { name: '爽口水果小黃瓜', cat: 'vege', per100gKcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
    { name: '金針菇 / 杏鮑菇', cat: 'vege', per100gKcal: 37, protein: 2.7, carbs: 7.8, fat: 0.4 },
    { name: '甜脆彩椒', cat: 'vege', per100gKcal: 26, protein: 1.0, carbs: 6.0, fat: 0.3 },

    // 水果與健康油脂
    { name: '富士大蘋果', cat: 'fruit', per100gKcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2 },
    { name: '新鮮香蕉', cat: 'fruit', per100gKcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
    { name: '進口成熟酪梨', cat: 'fruit', per100gKcal: 160, protein: 2.0, carbs: 8.5, fat: 14.7 },
    { name: '無調味綜合堅果', cat: 'fruit', per100gKcal: 607, protein: 20.0, carbs: 16.0, fat: 54.0 },
    { name: '藍莓 (抗氧化花青素)', cat: 'fruit', per100gKcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },

    // 飲品乳品
    { name: '美式無糖黑咖啡', cat: 'drink', per100gKcal: 2, protein: 0.1, carbs: 0.3, fat: 0 },
    { name: '特濃無糖黑豆漿', cat: 'drink', per100gKcal: 45, protein: 4.8, carbs: 2.2, fat: 1.9 },
    { name: '希臘零脂無糖優格', cat: 'drink', per100gKcal: 59, protein: 10.0, carbs: 3.6, fat: 0.4 },
    { name: '乳清蛋白粉沖泡飲', cat: 'drink', per100gKcal: 120, protein: 24.0, carbs: 2.0, fat: 1.5 },
    { name: '無糖日本綠茶', cat: 'drink', per100gKcal: 1, protein: 0.1, carbs: 0.2, fat: 0 }
  ];

  /* ==========================================================================
     3. 原生音效合成器 (Web Audio API Synthesizer)
     無需下載外部音訊，零延遲生成清脆提示音
     ========================================================================== */
  const SoundFX = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
    },
    playTone(freq, type, duration, gainVal = 0.1) {
      if (!state.soundEnabled) return;
      try {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // 音效靜默防禦
      }
    },
    tap() {
      this.playTone(800, 'sine', 0.05, 0.08);
    },
    success() {
      this.playTone(523.25, 'triangle', 0.1, 0.1); // C5
      setTimeout(() => this.playTone(659.25, 'triangle', 0.12, 0.1), 80); // E5
      setTimeout(() => this.playTone(783.99, 'triangle', 0.2, 0.1), 160); // G5
    },
    beep() {
      this.playTone(880, 'sine', 0.1, 0.12);
    },
    doubleBeep() {
      this.playTone(1046.5, 'square', 0.15, 0.15);
      setTimeout(() => this.playTone(1318.5, 'square', 0.2, 0.15), 180);
    }
  };

  /* ==========================================================================
     4. 全局 Toast 提示小組件
     ========================================================================== */
  function showToast(message, icon = 'fa-solid fa-circle-check') {
    const toast = document.getElementById('globalToast');
    const msgEl = document.getElementById('toastMessage');
    const iconEl = toast.querySelector('.toast-icon i');

    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    iconEl.className = icon;
    toast.classList.add('show');

    SoundFX.tap();

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  /* ==========================================================================
     5. SPA / 多頁面導航路由切換引擎 (Navigation Router)
     ========================================================================== */
  const navTabs = document.querySelectorAll('.bottom-nav-bar .nav-tab');
  const pages = document.querySelectorAll('.app-viewport .app-page');

  function switchPage(targetPageId) {
    if (pages.length > 0) {
      pages.forEach(page => {
        if (page.id === targetPageId) {
          page.classList.add('active-page');
        } else {
          page.classList.remove('active-page');
        }
      });
    }

    navTabs.forEach(tab => {
      if (tab.getAttribute('data-target') === targetPageId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    SoundFX.tap();

    // 如果切換到體重趨勢頁面，自動重繪體重圖表
    if (targetPageId === 'page-trends' && typeof renderWeightChart === 'function') {
      renderWeightChart('7');
    }

    // 捲動至頂部
    const viewport = document.getElementById('appViewport');
    if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetId = tab.getAttribute('data-target');
      const href = tab.getAttribute('href');
      const targetEl = targetId ? document.getElementById(targetId) : null;

      // 若目前頁面包含該區塊，平滑頁內切換；若無則自然跳轉至獨立子頁面
      if (targetEl) {
        e.preventDefault();
        switchPage(targetId);
      } else if (href && href !== '#' && !href.startsWith('javascript:')) {
        SoundFX.tap();
      }
    });
  });

  // 支援 URL 參數直接打開指定頁籤：如 index.html?tab=trends 或 #fasting
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
  if (tabParam) {
    const pageId = tabParam.startsWith('page-') ? tabParam : `page-${tabParam}`;
    if (document.getElementById(pageId)) {
      switchPage(pageId);
    }
  }

  // 頭像點擊跳轉到個人中心
  const avatarRing = document.getElementById('openProfileFromAvatar');
  if (avatarRing) {
    avatarRing.addEventListener('click', () => switchPage('page-profile'));
  }

  // 首頁橫幅點擊跳轉到斷食頁
  const bannerGoFasting = document.getElementById('bannerGoFasting');
  if (bannerGoFasting) {
    bannerGoFasting.addEventListener('click', () => switchPage('page-fasting'));
  }

  // 首頁步數卡按鈕跳轉到運動頁
  const btnGoWorkout = document.getElementById('btnGoWorkout');
  if (btnGoWorkout) {
    btnGoWorkout.addEventListener('click', () => switchPage('page-workout'));
  }

  // 今日餐飲管理跳轉到飲食日記
  const btnViewAllMeals = document.getElementById('btnViewAllMeals');
  if (btnViewAllMeals) {
    btnViewAllMeals.addEventListener('click', () => switchPage('page-diet'));
  }

  /* ==========================================================================
     6. 核心計算模組：熱量平衡與宏觀營養素
     ========================================================================== */
  function calculateTotalIntake() {
    let total = 0;
    let carbs = 0;
    let protein = 0;
    let fat = 0;

    const meals = state.today.meals;
    for (const key in meals) {
      meals[key].forEach(item => {
        total += item.kcal;
        carbs += item.carbs || 0;
        protein += item.protein || 0;
        fat += item.fat || 0;
      });
    }

    return { total, carbs, protein, fat };
  }

  function updateDashboardMetrics() {
    const { total, carbs, protein, fat } = calculateTotalIntake();
    const target = state.goals.targetCalorie;
    const burn = state.today.workoutBurn;
    const remain = Math.max(0, target - total + burn);

    // 更新首頁圓環
    const remainEl = document.getElementById('remainCalorieNum');
    const targetEl = document.getElementById('targetCalorieVal');
    const intakeEl = document.getElementById('intakeCalorieVal');
    const burnEl = document.getElementById('burnCalorieVal');
    const calorieRingBar = document.getElementById('calorieRingBar');

    if (remainEl) remainEl.textContent = remain.toLocaleString();
    if (targetEl) targetEl.textContent = target.toLocaleString();
    if (intakeEl) intakeEl.textContent = total.toLocaleString();
    if (burnEl) burnEl.textContent = `+${burn.toLocaleString()}`;

    // 圓環周長 2 * PI * 68 ≈ 427.26
    if (calorieRingBar) {
      const circumference = 427.26;
      const progressRatio = Math.min(1, total / (target + burn));
      const offset = circumference * (1 - progressRatio);
      calorieRingBar.style.strokeDashoffset = offset;
    }

    // 更新三大營養素進度條
    const carbFill = document.getElementById('carbBarFill');
    const proteinFill = document.getElementById('proteinBarFill');
    const fatFill = document.getElementById('fatBarFill');

    if (carbFill) {
      const pct = Math.min(100, Math.round((carbs / state.goals.carbs) * 100));
      carbFill.style.width = `${pct}%`;
      const txt = document.getElementById('carbRatioText');
      if (txt) txt.textContent = `${carbs}/${state.goals.carbs}g`;
    }

    if (proteinFill) {
      const pct = Math.min(100, Math.round((protein / state.goals.protein) * 100));
      proteinFill.style.width = `${pct}%`;
      const txt = document.getElementById('proteinRatioText');
      if (txt) txt.textContent = `${protein}/${state.goals.protein}g`;
    }

    if (fatFill) {
      const pct = Math.min(100, Math.round((fat / state.goals.fat) * 100));
      fatFill.style.width = `${pct}%`;
      const txt = document.getElementById('fatRatioText');
      if (txt) txt.textContent = `${fat}/${state.goals.fat}g`;
    }

    // 更新飲食日記頂部數據
    const dietIntake = document.getElementById('dietTotalIntake');
    const dietRemain = document.getElementById('dietRemainKcal');
    if (dietIntake) dietIntake.textContent = total.toLocaleString();
    if (dietRemain) dietRemain.textContent = remain.toLocaleString();

    // 更新首頁三餐縮圖摘要
    updateMealSummaries();

    // 更新海報預覽指標
    const posterIntake = document.getElementById('posterIntake');
    const posterBurn = document.getElementById('posterBurn');
    const posterWater = document.getElementById('posterWater');
    if (posterIntake) posterIntake.textContent = total.toLocaleString();
    if (posterBurn) posterBurn.textContent = burn.toLocaleString();
    if (posterWater) posterWater.textContent = state.today.water.toLocaleString();

    saveState();
  }

  function updateMealSummaries() {
    const meals = state.today.meals;
    const summaries = {
      breakfast: { sum: document.getElementById('dashBfSummary'), cal: document.getElementById('dashBfCal') },
      lunch: { sum: document.getElementById('dashLcSummary'), cal: document.getElementById('dashLcCal') },
      dinner: { sum: document.getElementById('dashDnSummary'), cal: document.getElementById('dashDnCal') }
    };

    for (const type in summaries) {
      const items = meals[type] || [];
      const totalCal = items.reduce((acc, curr) => acc + curr.kcal, 0);
      const names = items.map(i => i.name).join(' + ') || '今日尚未添加食物';

      if (summaries[type].sum) summaries[type].sum.textContent = names;
      if (summaries[type].cal) summaries[type].cal.textContent = totalCal;
    }

    // 重新渲染飲食日記列表
    renderDietPageMeals();
  }

  function renderDietPageMeals() {
    const listMap = {
      breakfast: { list: document.getElementById('bfFoodList'), sub: document.getElementById('bfSubtotal') },
      lunch: { list: document.getElementById('lcFoodList'), sub: document.getElementById('lcSubtotal') },
      dinner: { list: document.getElementById('dnFoodList'), sub: document.getElementById('dnSubtotal') },
      snack: { list: document.getElementById('snFoodList'), sub: document.getElementById('snSubtotal') }
    };

    for (const type in listMap) {
      const container = listMap[type].list;
      const subtotalEl = listMap[type].sub;
      if (!container) continue;

      const items = state.today.meals[type] || [];
      const subtotal = items.reduce((acc, curr) => acc + curr.kcal, 0);
      if (subtotalEl) subtotalEl.textContent = `${subtotal} kcal`;

      container.innerHTML = '';
      if (items.length === 0) {
        container.innerHTML = `<div class="empty-food-tip">今日尚未添加食物記錄</div>`;
      } else {
        items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'food-entry-item';
          row.innerHTML = `
            <div class="fei-left">
              <span class="fei-name">${item.name}</span>
              <span class="fei-portion">${item.portion}g · 蛋${item.protein || 0}g 碳${item.carbs || 0}g 脂${item.fat || 0}g</span>
            </div>
            <div class="fei-right">
              <span class="fei-kcal">${item.kcal} kcal</span>
              <button class="fei-delete-btn" data-type="${type}" data-id="${item.id}" title="刪除"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          `;
          container.appendChild(row);
        });
      }
    }

    // 綁定刪除食物按鈕
    document.querySelectorAll('.fei-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        deleteFoodItem(type, id);
      });
    });
  }

  function deleteFoodItem(mealType, id) {
    if (!state.today.meals[mealType]) return;
    state.today.meals[mealType] = state.today.meals[mealType].filter(item => item.id !== id);
    showToast('已刪除餐點記錄');
    updateDashboardMetrics();
  }

  /* ==========================================================================
     7. 喝水互動模組 (Water Tracker with Waves)
     ========================================================================== */
  const quickWaterBtns = document.querySelectorAll('.quick-water-btn');
  quickWaterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const addAmount = parseInt(btn.getAttribute('data-add'), 10);
      addWater(addAmount);
    });
  });

  function addWater(amount) {
    state.today.water += amount;
    const goal = state.goals.water;
    const countEl = document.getElementById('waterCount');
    const descEl = document.getElementById('waterDescText');
    const waveFill = document.getElementById('waterWaveFill');

    const pct = Math.min(100, Math.round((state.today.water / goal) * 100));

    if (countEl) countEl.textContent = state.today.water.toLocaleString();
    if (descEl) descEl.textContent = `已喝約 ${Math.round(state.today.water / 250)} 杯，進度 ${pct}%`;
    if (waveFill) waveFill.style.width = `${pct}%`;

    SoundFX.success();
    showToast(`💦 補水 +${amount}ml，距離達標還剩 ${Math.max(0, goal - state.today.water)}ml！`);

    // 同步更新海報中的飲水量
    const posterWater = document.getElementById('posterWater');
    if (posterWater) posterWater.textContent = state.today.water.toLocaleString();

    saveState();
  }

  /* ==========================================================================
     8. 16:8 間歇性斷食實時指針 (Fasting Engine)
     ========================================================================== */
  function updateFastingClock() {
    if (!state.fasting.isRunning) return;

    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - state.fasting.startTime) / 1000));
    const targetSeconds = state.fasting.targetHours * 3600;

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // 更新靈動島與斷食主視圖
    const islandTimer = document.getElementById('islandTimer');
    const fastTimeDisplay = document.getElementById('fastTimeDisplay');
    const bannerFastTimer = document.getElementById('bannerFastTimer');
    const fastRemainDisplay = document.getElementById('fastRemainDisplay');

    if (islandTimer) islandTimer.textContent = formattedTime;
    if (fastTimeDisplay) fastTimeDisplay.textContent = formattedTime;
    if (bannerFastTimer) bannerFastTimer.textContent = `${hours}h ${minutes}m`;

    const remainSeconds = Math.max(0, targetSeconds - elapsedSeconds);
    const remainHours = Math.floor(remainSeconds / 3600);
    const remainMinutes = Math.floor((remainSeconds % 3600) / 60);

    if (fastRemainDisplay) {
      if (remainSeconds > 0) {
        fastRemainDisplay.textContent = `距離結束還剩 ${remainHours}小時${remainMinutes}分`;
      } else {
        fastRemainDisplay.textContent = `🔥 已超額達成斷食！自噬反應持續中`;
      }
    }

    // 圓形指針 SVG 進度：周長 2 * PI * 100 ≈ 628.32
    const fastingRingBar = document.getElementById('fastingRingBar');
    if (fastingRingBar) {
      const circumference = 628.32;
      const ratio = Math.min(1, elapsedSeconds / targetSeconds);
      fastingRingBar.style.strokeDashoffset = circumference * (1 - ratio);
    }
  }

  setInterval(updateFastingClock, 1000);
  updateFastingClock();

  // 斷食方案切換 (16:8, 18:6, 14:10, 20:4)
  const planTabs = document.querySelectorAll('.plan-tabs-row .plan-tab');
  planTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      planTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const plan = tab.getAttribute('data-fast-plan');
      state.fasting.plan = plan;

      const hourMap = { '16-8': 16, '18-6': 18, '14-10': 14, '20-4': 20 };
      state.fasting.targetHours = hourMap[plan] || 16;

      const targetPill = document.getElementById('fastTargetPill');
      if (targetPill) targetPill.textContent = `目標 ${state.fasting.targetHours} 小時`;

      const islandTitle = document.getElementById('islandTitle');
      if (islandTitle) islandTitle.textContent = `燃脂中 ${plan.replace('-', ':')}`;

      SoundFX.tap();
      showToast(`已切換為 ${plan.replace('-', ':')} 斷食方案（目標 ${state.fasting.targetHours}h）`);
      updateFastingClock();
      saveState();
    });
  });

  // 結束/開啟斷食按鈕
  const btnToggleFasting = document.getElementById('btnToggleFasting');
  if (btnToggleFasting) {
    btnToggleFasting.addEventListener('click', () => {
      if (state.fasting.isRunning) {
        state.fasting.isRunning = false;
        btnToggleFasting.innerHTML = `<i class="fa-solid fa-play"></i> 開啟新一輪斷食`;
        btnToggleFasting.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        showToast('🎉 今日斷食已成功結算！給自己點個讚');
        SoundFX.success();
      } else {
        state.fasting.isRunning = true;
        state.fasting.startTime = Date.now();
        btnToggleFasting.innerHTML = `<i class="fa-solid fa-pause"></i> 結束今日斷食`;
        btnToggleFasting.style.background = 'linear-gradient(135deg, var(--accent-coral), var(--accent-coral-dark))';
        showToast('🚀 已啟動新一輪斷食計時！多喝溫水保持代謝');
        SoundFX.tap();
      }
      saveState();
    });
  }

  // 斷食補水
  const btnLogFastWater = document.getElementById('btnLogFastWater');
  if (btnLogFastWater) {
    btnLogFastWater.addEventListener('click', () => addWater(300));
  }

  /* ==========================================================================
     9. 食物庫搜尋彈窗與新增邏輯 (Food Search Modal)
     ========================================================================== */
  const foodModalOverlay = document.getElementById('foodModalOverlay');
  const btnCloseFoodModal = document.getElementById('btnCloseFoodModal');
  const foodSearchInput = document.getElementById('foodSearchInput');
  const clearSearchBtn = document.getElementById('btnClearSearch');
  const foodResultsList = document.getElementById('foodResultsList');
  const portionPanel = document.getElementById('portionPanel');
  const portionSlider = document.getElementById('portionSlider');
  const portionValDisplay = document.getElementById('portionValDisplay');
  const portionFoodName = document.getElementById('portionFoodName');
  const portionPer100g = document.getElementById('portionPer100g');
  const portionKcalPreview = document.getElementById('portionKcalPreview');
  const btnConfirmAddFood = document.getElementById('btnConfirmAddFood');

  let currentSelectingMealType = 'breakfast';
  let selectedFoodItem = null;

  function openFoodModal(mealType) {
    currentSelectingMealType = mealType;
    const titleMap = {
      breakfast: '早晨輕食 (早餐)',
      lunch: '活力午餐',
      dinner: '飽腹低卡晚餐',
      snack: '加餐與健康零食'
    };
    const titleEl = document.getElementById('foodModalMealTitle');
    if (titleEl) titleEl.textContent = `添加餐食 · ${titleMap[mealType] || '美味日記'}`;

    renderFoodSearchResults(foodDatabase);
    foodModalOverlay.classList.add('active');
    portionPanel.style.display = 'none';
    selectedFoodItem = null;
    SoundFX.tap();
  }

  // 綁定所有開啟食物彈窗的按鈕
  document.querySelectorAll('.open-food-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const meal = btn.getAttribute('data-meal');
      openFoodModal(meal);
    });
  });

  const btnCustomFoodQuick = document.getElementById('btnCustomFoodQuick');
  if (btnCustomFoodQuick) {
    btnCustomFoodQuick.addEventListener('click', () => openFoodModal('snack'));
  }

  if (btnCloseFoodModal) {
    btnCloseFoodModal.addEventListener('click', () => {
      foodModalOverlay.classList.remove('active');
    });
  }

  function renderFoodSearchResults(items) {
    if (!foodResultsList) return;
    foodResultsList.innerHTML = '';

    if (items.length === 0) {
      foodResultsList.innerHTML = `<div class="empty-food-tip">未搜尋到相關食物，可嘗試更換關鍵字</div>`;
      return;
    }

    items.forEach(food => {
      const card = document.createElement('div');
      card.className = 'food-result-card';
      card.innerHTML = `
        <div class="frc-info">
          <h4>${food.name}</h4>
          <p>每 100g: 蛋 ${food.protein}g · 碳水 ${food.carbs}g · 脂肪 ${food.fat}g</p>
        </div>
        <div class="frc-kcal">
          ${food.per100gKcal} <small style="font-size:10px; color:var(--text-muted)">kcal/100g</small>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.food-result-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectFoodForPortion(food);
      });

      foodResultsList.appendChild(card);
    });
  }

  function selectFoodForPortion(food) {
    selectedFoodItem = food;
    portionPanel.style.display = 'flex';
    portionFoodName.textContent = food.name;
    portionPer100g.textContent = `每 100g 含 ${food.per100gKcal} kcal · 蛋白質 ${food.protein}g`;
    portionSlider.value = 100;
    updatePortionCalc();
    SoundFX.tap();
  }

  function updatePortionCalc() {
    if (!selectedFoodItem) return;
    const grams = parseInt(portionSlider.value, 10);
    portionValDisplay.textContent = grams;

    const factor = grams / 100;
    const computedKcal = Math.round(selectedFoodItem.per100gKcal * factor);
    portionKcalPreview.textContent = `${computedKcal} kcal`;
  }

  if (portionSlider) {
    portionSlider.addEventListener('input', updatePortionCalc);
  }

  if (btnConfirmAddFood) {
    btnConfirmAddFood.addEventListener('click', () => {
      if (!selectedFoodItem) return;
      const grams = parseInt(portionSlider.value, 10);
      const factor = grams / 100;

      const newEntry = {
        id: 'food_' + Date.now(),
        name: selectedFoodItem.name,
        portion: grams,
        kcal: Math.round(selectedFoodItem.per100gKcal * factor),
        protein: Math.round(selectedFoodItem.protein * factor),
        carbs: Math.round(selectedFoodItem.carbs * factor),
        fat: Math.round(selectedFoodItem.fat * factor)
      };

      if (!state.today.meals[currentSelectingMealType]) {
        state.today.meals[currentSelectingMealType] = [];
      }
      state.today.meals[currentSelectingMealType].push(newEntry);

      foodModalOverlay.classList.remove('active');
      SoundFX.success();
      showToast(`已成功記錄「${newEntry.name}」(${newEntry.kcal} kcal)！`);
      updateDashboardMetrics();
    });
  }

  // 搜索欄過濾
  if (foodSearchInput) {
    foodSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const filtered = foodDatabase.filter(f => f.name.toLowerCase().includes(query));
      renderFoodSearchResults(filtered);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      foodSearchInput.value = '';
      renderFoodSearchResults(foodDatabase);
    });
  }

  // 食物分類標籤過濾
  const foodCatBtns = document.querySelectorAll('.food-cat-strip .f-cat-btn');
  foodCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      foodCatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cat = btn.getAttribute('data-cat');
      if (cat === 'all') {
        renderFoodSearchResults(foodDatabase);
      } else {
        const filtered = foodDatabase.filter(f => f.cat === cat);
        renderFoodSearchResults(filtered);
      }
      SoundFX.tap();
    });
  });

  /* ==========================================================================
     10. 體重記錄滑尺彈窗與圖表繪製 (Weight Logger & SVG Chart)
     ========================================================================== */
  const weightModalOverlay = document.getElementById('weightModalOverlay');
  const btnCloseWeightModal = document.getElementById('btnCloseWeightModal');
  const btnLogWeightNow = document.getElementById('btnLogWeightNow');
  const weightRulerInput = document.getElementById('weightRulerInput');
  const pickerWeightVal = document.getElementById('pickerWeightVal');
  const pickerDiffTip = document.getElementById('pickerDiffTip');
  const btnSaveWeightEntry = document.getElementById('btnSaveWeightEntry');
  const weightNoteInput = document.getElementById('weightNoteInput');

  function openWeightModal() {
    weightRulerInput.value = state.user.currentWeight;
    pickerWeightVal.textContent = state.user.currentWeight.toFixed(1);
    weightModalOverlay.classList.add('active');
    SoundFX.tap();
  }

  if (btnLogWeightNow) btnLogWeightNow.addEventListener('click', openWeightModal);
  if (btnCloseWeightModal) btnCloseWeightModal.addEventListener('click', () => weightModalOverlay.classList.remove('active'));

  if (weightRulerInput) {
    weightRulerInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value).toFixed(1);
      pickerWeightVal.textContent = val;
      const diff = (val - state.user.startWeight).toFixed(1);
      pickerDiffTip.innerHTML = `相較初始體重 <strong>${diff > 0 ? '+' : ''}${diff} kg</strong>`;
    });
  }

  if (btnSaveWeightEntry) {
    btnSaveWeightEntry.addEventListener('click', () => {
      const newWeight = parseFloat(weightRulerInput.value);
      state.user.currentWeight = newWeight;

      const todayStr = '10/19';
      const note = weightNoteInput.value.trim() || '晨起測量';

      state.weightHistory.push({
        date: todayStr,
        weight: newWeight,
        note: note
      });

      weightModalOverlay.classList.remove('active');
      SoundFX.success();
      showToast(`體重記錄 ${newWeight}kg 已更新！`);

      updateBodyStats();
      renderWeightChart('7');
      renderWeightHistoryList();
      saveState();
    });
  }

  function updateBodyStats() {
    const cur = state.user.currentWeight;
    const start = state.user.startWeight;
    const target = state.user.targetWeight;
    const heightM = state.user.height / 100;

    const bmi = (cur / (heightM * heightM)).toFixed(1);
    const totalLost = (start - cur).toFixed(1);
    const remainToGoal = Math.max(0, (cur - target)).toFixed(1);

    const goalPct = Math.min(100, Math.max(0, (((start - cur) / (start - target)) * 100))).toFixed(1);

    const curDisplay = document.getElementById('currentWeightDisplay');
    const goalFill = document.getElementById('weightGoalFill');
    const goalPctEl = document.getElementById('weightGoalPct');
    const valBMI = document.getElementById('valBMI');

    if (curDisplay) curDisplay.textContent = cur.toFixed(1);
    if (goalFill) goalFill.style.width = `${goalPct}%`;
    if (goalPctEl) goalPctEl.textContent = `已完成 ${goalPct}%`;
    if (valBMI) valBMI.textContent = bmi;

    // 同步更新 BMI 精算卡片輸入框（若當前未在焦點輸入中）
    const bmiInputHeight = document.getElementById('bmiInputHeight');
    const bmiInputWeight = document.getElementById('bmiInputWeight');
    if (bmiInputHeight && document.activeElement !== bmiInputHeight) {
      bmiInputHeight.value = state.user.height;
    }
    if (bmiInputWeight && document.activeElement !== bmiInputWeight) {
      bmiInputWeight.value = state.user.currentWeight;
    }
    if (typeof calcLiveBMI === 'function') {
      calcLiveBMI();
    }
  }

  // 繪製動態 SVG 體重平滑折線圖
  function renderWeightChart(range = '7') {
    const container = document.getElementById('weightChartBox');
    if (!container) return;

    let data = state.weightHistory.slice(-7);
    if (range === '30') data = state.weightHistory.slice(-30);

    const width = container.clientWidth || 330;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 35 };

    const minWeight = Math.min(...data.map(d => d.weight)) - 0.6;
    const maxWeight = Math.max(...data.map(d => d.weight)) + 0.6;

    const getX = (index) => padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
    const getY = (weight) => padding.top + ((maxWeight - weight) / (maxWeight - minWeight)) * (height - padding.top - padding.bottom);

    let pathD = '';
    let areaD = '';
    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.weight), ...d }));

    points.forEach((p, i) => {
      if (i === 0) {
        pathD += `M ${p.x} ${p.y}`;
        areaD += `M ${p.x} ${height - padding.bottom} L ${p.x} ${p.y}`;
      } else {
        const prev = points[i - 1];
        const cpX = (prev.x + p.x) / 2;
        pathD += ` C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
        areaD += ` C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
      }
    });

    const last = points[points.length - 1];
    areaD += ` L ${last.x} ${height - padding.bottom} Z`;

    let circlesSvg = '';
    points.forEach((p) => {
      circlesSvg += `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#10B981" stroke="#fff" stroke-width="2" class="chart-point" data-date="${p.date}" data-w="${p.weight}"></circle>
        <text x="${p.x}" y="${height - 10}" font-size="10" fill="var(--text-muted)" text-anchor="middle">${p.date}</text>
      `;
    });

    container.innerHTML = `
      <svg width="${width}" height="${height}" style="overflow: visible;">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <!-- 背景水平網格線 -->
        <line x1="${padding.left}" y1="${getY(minWeight + 0.6)}" x2="${width - padding.right}" y2="${getY(minWeight + 0.6)}" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <line x1="${padding.left}" y1="${getY((minWeight + maxWeight) / 2)}" x2="${width - padding.right}" y2="${getY((minWeight + maxWeight) / 2)}" stroke="var(--border-color)" stroke-dasharray="3,3" />
        
        <!-- 漸層面積與折線 -->
        <path d="${areaD}" fill="url(#chartGradient)"></path>
        <path d="${pathD}" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round"></path>
        
        <!-- 節點圓圈 -->
        ${circlesSvg}
      </svg>
    `;
  }

  // 區間切換按鈕
  document.querySelectorAll('.c-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.c-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderWeightChart(btn.getAttribute('data-range'));
      SoundFX.tap();
    });
  });

  function renderWeightHistoryList() {
    const listEl = document.getElementById('weightHistoryContainer');
    if (!listEl) return;
    listEl.innerHTML = '';

    const sorted = [...state.weightHistory].reverse();
    sorted.forEach((item, index) => {
      const prev = sorted[index + 1];
      const diff = prev ? (item.weight - prev.weight).toFixed(1) : '0.0';
      const diffClass = diff <= 0 ? 'text-emerald' : 'text-coral';

      const row = document.createElement('div');
      row.className = 'wh-entry-row';
      row.innerHTML = `
        <div class="wh-date-box">
          <span class="wh-date">${item.date}</span>
          <span class="wh-note">${item.note}</span>
        </div>
        <div class="wh-weight-box">
          <span class="wh-w-val">${item.weight.toFixed(1)} kg</span>
          <span class="wh-diff ${diffClass}">${diff <= 0 ? '' : '+'}${diff} kg</span>
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  /* ==========================================================================
     10.1 BMI 智能健康體重精算器交互邏輯 (Interactive BMI Calculator)
     ========================================================================== */
  const bmiInputHeight = document.getElementById('bmiInputHeight');
  const bmiInputWeight = document.getElementById('bmiInputWeight');
  const bmiNeedle = document.getElementById('bmiNeedle');
  const bmiLiveVal = document.getElementById('bmiLiveVal');
  const bmiStatusBadge = document.getElementById('bmiStatusBadge');
  const bmiAdviceText = document.getElementById('bmiAdviceText');
  const btnSyncBmiData = document.getElementById('btnSyncBmiData');

  function calcLiveBMI() {
    if (!bmiInputHeight || !bmiInputWeight) return;

    const heightVal = parseFloat(bmiInputHeight.value);
    const weightVal = parseFloat(bmiInputWeight.value);

    if (isNaN(heightVal) || isNaN(weightVal) || heightVal <= 0 || weightVal <= 0) {
      if (bmiLiveVal) bmiLiveVal.textContent = '--';
      return;
    }

    const hM = heightVal / 100;
    const bmi = weightVal / (hM * hM);
    const bmiFormatted = bmi.toFixed(1);

    if (bmiLiveVal) bmiLiveVal.textContent = bmiFormatted;

    // 計算正常體重範圍 (BMI 18.5 ~ 23.9)
    const minNormalWeight = (18.5 * hM * hM).toFixed(1);
    const maxNormalWeight = (23.9 * hM * hM).toFixed(1);

    let statusText = '';
    let badgeClass = '';
    let adviceHTML = '';
    let needlePct = 50;

    if (bmi < 18.5) {
      statusText = '偏瘦體態';
      badgeClass = 'badge-under';
      // 14 ~ 18.5 區間映射至 4% ~ 22%
      const ratio = Math.max(0, Math.min(1, (bmi - 14) / (18.5 - 14)));
      needlePct = 4 + ratio * 18;
      adviceHTML = `身高 <strong>${heightVal} cm</strong> 的標準健康體重為 <strong>${minNormalWeight} ~ ${maxNormalWeight} kg</strong>。目前體態偏瘦，建議適度提升優質蛋白質攝入並配合力量抗阻訓練增肌塑形！`;
    } else if (bmi <= 23.9) {
      statusText = '標準理想';
      badgeClass = 'badge-normal';
      // 18.5 ~ 23.9 區間映射至 22% ~ 58%
      const ratio = Math.max(0, Math.min(1, (bmi - 18.5) / (23.9 - 18.5)));
      needlePct = 22 + ratio * 36;
      adviceHTML = `身高 <strong>${heightVal} cm</strong> 的標準健康體重為 <strong>${minNormalWeight} ~ ${maxNormalWeight} kg</strong>，目前處於理想黃金區間，請繼續保持目前的自律習慣與均衡身心節奏！`;
    } else if (bmi <= 27.9) {
      statusText = '微胖超重';
      badgeClass = 'badge-over';
      // 24.0 ~ 27.9 區間映射至 58% ~ 82%
      const ratio = Math.max(0, Math.min(1, (bmi - 24.0) / (27.9 - 24.0)));
      needlePct = 58 + ratio * 24;
      adviceHTML = `身高 <strong>${heightVal} cm</strong> 的標準健康體重為 <strong>${minNormalWeight} ~ ${maxNormalWeight} kg</strong>。目前處於微超重區間，建議設定每日 300~500 kcal 赤字並搭配 16:8 斷食，預計 6~8 週可重返理想身型！`;
    } else {
      statusText = '肥胖預警';
      badgeClass = 'badge-obese';
      // 28.0 ~ 36.0 區間映射至 82% ~ 96%
      const ratio = Math.max(0, Math.min(1, (bmi - 28.0) / (36.0 - 28.0)));
      needlePct = 82 + ratio * 14;
      adviceHTML = `身高 <strong>${heightVal} cm</strong> 的標準健康體重為 <strong>${minNormalWeight} ~ ${maxNormalWeight} kg</strong>。已達肥胖健康預警標準，建議啟動 MindFit 深度燃脂計畫，規律有氧配合低碳控糖！`;
    }

    if (bmiNeedle) {
      bmiNeedle.style.left = `${needlePct.toFixed(1)}%`;
    }
    if (bmiStatusBadge) {
      bmiStatusBadge.className = `bic-badge ${badgeClass}`;
      bmiStatusBadge.textContent = statusText;
    }
    if (bmiAdviceText) {
      bmiAdviceText.innerHTML = adviceHTML;
    }
  }

  // 實時監聽身高體重數值輸入
  if (bmiInputHeight) {
    bmiInputHeight.addEventListener('input', () => {
      calcLiveBMI();
    });
  }
  if (bmiInputWeight) {
    bmiInputWeight.addEventListener('input', () => {
      calcLiveBMI();
    });
  }

  // 點擊「同步更新全站身材指標」按鈕
  if (btnSyncBmiData) {
    btnSyncBmiData.addEventListener('click', () => {
      if (!bmiInputHeight || !bmiInputWeight) return;

      const newH = parseFloat(bmiInputHeight.value);
      const newW = parseFloat(bmiInputWeight.value);

      if (isNaN(newH) || isNaN(newW) || newH < 100 || newH > 250 || newW < 30 || newW > 250) {
        showToast('請輸入合理的身高 (100~250cm) 與體重 (30~250kg)！', 'fa-solid fa-triangle-exclamation');
        return;
      }

      state.user.height = newH;
      state.user.currentWeight = newW;

      // 同步到今日體重歷程 (如果今天最後一筆相同日期則更新，否則新增)
      const todayStr = '10/19';
      if (state.weightHistory.length > 0 && state.weightHistory[state.weightHistory.length - 1].date === todayStr) {
        state.weightHistory[state.weightHistory.length - 1].weight = newW;
        state.weightHistory[state.weightHistory.length - 1].note = 'BMI 計算器同步更新';
      } else {
        state.weightHistory.push({
          date: todayStr,
          weight: newW,
          note: 'BMI 計算器同步'
        });
      }

      // 重新計算 BMR 與 TDEE
      let bmr = 10 * newW + 6.25 * newH - 5 * state.user.age;
      bmr += (state.user.gender === 'male' ? 5 : -161);
      const tdee = Math.round(bmr * state.user.activity);
      const targetCalorie = Math.max(1200, tdee - state.user.deficit);
      state.goals.targetCalorie = targetCalorie;
      state.goals.carbs = Math.round((targetCalorie * 0.45) / 4);
      state.goals.protein = Math.round((targetCalorie * 0.30) / 4);
      state.goals.fat = Math.round((targetCalorie * 0.25) / 9);

      // 更新 DOM 數值
      updateBodyStats();
      updateDashboardMetrics();

      // 更新個人資料面板
      const profileBio = document.getElementById('profileBioInfo');
      const profileTDEE = document.getElementById('profileTDEE');
      const profileRec = document.getElementById('profileRecIntake');
      const valBMR = document.getElementById('valBMR');
      if (profileBio) profileBio.textContent = `${newH} cm · ${newW} kg · ${state.user.age}歲 (${state.user.gender === 'male' ? '男' : '女'})`;
      if (profileTDEE) profileTDEE.textContent = `${tdee.toLocaleString()} kcal/天`;
      if (profileRec) profileRec.textContent = `${targetCalorie.toLocaleString()} kcal`;
      if (valBMR) valBMR.textContent = Math.round(bmr).toLocaleString();

      // 同步 TDEE 彈窗內表單
      const calcHeight = document.getElementById('calcHeight');
      const calcWeight = document.getElementById('calcWeight');
      if (calcHeight) calcHeight.value = newH;
      if (calcWeight) calcWeight.value = newW;

      // 刷新圖表與列表
      renderWeightChart('7');
      renderWeightHistoryList();

      saveState();
      SoundFX.success();
      showToast(`🎯 身高 ${newH}cm、體重 ${newW}kg 已同步更新！全站指標與熱量預算已刷新`);
    });
  }

  /* ==========================================================================
     11. 全屏沉浸式 HIIT 訓練計時器 (Workout Player Modal)
     ========================================================================== */
  const workoutPlayerModal = document.getElementById('workoutPlayerModal');
  const btnCloseWorkoutPlayer = document.getElementById('btnCloseWorkoutPlayer');
  const btnPlayerPlayPause = document.getElementById('btnPlayerPlayPause');
  const btnFinishWorkoutEarly = document.getElementById('btnFinishWorkoutEarly');
  const playerSecondsDisplay = document.getElementById('playerSecondsDisplay');
  const playerActionName = document.getElementById('playerActionName');
  const playerNextMove = document.getElementById('playerNextMove');
  const playerTimerRing = document.getElementById('playerTimerRing');
  const liveBurnVal = document.getElementById('liveBurnVal');
  const liveHeartRate = document.getElementById('liveHeartRate');
  const liveTotalMins = document.getElementById('liveTotalMins');

  let workoutInterval = null;
  let isWorkoutRunning = false;
  let currentMoveIndex = 0;
  let moveSecondsRemain = 45;
  let totalElapsedWorkoutSecs = 0;
  let currentWorkoutKcal = 0;

  const hiitMoves = [
    { name: '🔥 開合跳 (Jumping Jacks)', duration: 45, next: '深蹲跳 (休息 15秒)' },
    { name: '💧 呼吸休整 (Rest)', duration: 15, next: '爆發深蹲跳' },
    { name: '⚡ 爆發深蹲跳 (Squat Jumps)', duration: 40, next: '原地高抬腿' },
    { name: '💧 呼吸休整 (Rest)', duration: 15, next: '原地極速高抬腿' },
    { name: '🏃 原地極速高抬腿 (High Knees)', duration: 45, next: '核心平板支撐' },
    { name: '🧘 核心平板支撐 (Plank)', duration: 40, next: '即將完成訓練！' }
  ];

  function startWorkoutSession() {
    workoutPlayerModal.classList.add('active');
    currentMoveIndex = 0;
    loadMove(0);
    isWorkoutRunning = true;
    totalElapsedWorkoutSecs = 0;
    currentWorkoutKcal = 0;
    btnPlayerPlayPause.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    SoundFX.doubleBeep();

    clearInterval(workoutInterval);
    workoutInterval = setInterval(workoutTick, 1000);
  }

  function loadMove(index) {
    if (index >= hiitMoves.length) {
      finishWorkoutSession();
      return;
    }
    const move = hiitMoves[index];
    moveSecondsRemain = move.duration;
    playerActionName.textContent = move.name;
    playerNextMove.textContent = `下一個：${move.next}`;
    document.getElementById('playerSetsDisplay').textContent = `第 ${index + 1} / ${hiitMoves.length} 節`;
  }

  function workoutTick() {
    if (!isWorkoutRunning) return;

    totalElapsedWorkoutSecs++;
    moveSecondsRemain--;

    // 倒數最後 3 秒提示音
    if (moveSecondsRemain <= 3 && moveSecondsRemain > 0) {
      SoundFX.beep();
    }

    if (moveSecondsRemain <= 0) {
      currentMoveIndex++;
      SoundFX.doubleBeep();
      loadMove(currentMoveIndex);
      return;
    }

    // 計算燃燒熱量與模擬心率
    currentWorkoutKcal += 0.28;
    if (liveBurnVal) liveBurnVal.textContent = Math.round(currentWorkoutKcal);

    const heartRate = 135 + Math.floor(Math.sin(totalElapsedWorkoutSecs / 5) * 12);
    if (liveHeartRate) liveHeartRate.textContent = heartRate;

    const mins = Math.floor(totalElapsedWorkoutSecs / 60);
    const secs = totalElapsedWorkoutSecs % 60;
    if (liveTotalMins) liveTotalMins.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (playerSecondsDisplay) {
      playerSecondsDisplay.textContent = `00:${String(moveSecondsRemain).padStart(2, '0')}`;
    }

    // 圓環進度動畫：周長 2 * PI * 110 ≈ 691.15
    if (playerTimerRing) {
      const curMoveDuration = hiitMoves[currentMoveIndex].duration;
      const ratio = moveSecondsRemain / curMoveDuration;
      playerTimerRing.style.strokeDashoffset = 691.15 * (1 - ratio);
    }
  }

  function finishWorkoutSession() {
    clearInterval(workoutInterval);
    workoutPlayerModal.classList.remove('active');
    const addedKcal = Math.max(80, Math.round(currentWorkoutKcal));
    state.today.workoutBurn += addedKcal;
    state.today.workoutMins += Math.max(5, Math.round(totalElapsedWorkoutSecs / 60));

    SoundFX.success();
    showToast(`🏆 訓練大成功！本次消耗 +${addedKcal} kcal，已自動累加至今日赤字！`);
    updateDashboardMetrics();
  }

  document.querySelectorAll('.start-workout-btn').forEach(btn => {
    btn.addEventListener('click', startWorkoutSession);
  });

  if (btnCloseWorkoutPlayer) {
    btnCloseWorkoutPlayer.addEventListener('click', () => {
      clearInterval(workoutInterval);
      workoutPlayerModal.classList.remove('active');
    });
  }

  if (btnFinishWorkoutEarly) {
    btnFinishWorkoutEarly.addEventListener('click', finishWorkoutSession);
  }

  if (btnPlayerPlayPause) {
    btnPlayerPlayPause.addEventListener('click', () => {
      isWorkoutRunning = !isWorkoutRunning;
      btnPlayerPlayPause.innerHTML = isWorkoutRunning ? `<i class="fa-solid fa-pause"></i>` : `<i class="fa-solid fa-play"></i>`;
      SoundFX.tap();
    });
  }

  /* ==========================================================================
     12. TDEE 科學熱量預算計算機 (TDEE Calculator)
     使用權威 Mifflin-St Jeor 公式精算 BMR & TDEE
     ========================================================================== */
  const tdeeModalOverlay = document.getElementById('tdeeModalOverlay');
  const btnCloseTdeeModal = document.getElementById('btnCloseTdeeModal');
  const btnEditBudget = document.getElementById('btnEditBudget');
  const btnRecalculatePlan = document.getElementById('btnRecalculatePlan');
  const btnSaveTdeePlan = document.getElementById('btnSaveTdeePlan');

  function openTdeeModal() {
    document.getElementById('calcAge').value = state.user.age;
    document.getElementById('calcHeight').value = state.user.height;
    document.getElementById('calcWeight').value = state.user.currentWeight;
    document.getElementById('calcTargetWeight').value = state.user.targetWeight;
    document.getElementById('calcGender').value = state.user.gender;
    document.getElementById('calcActivity').value = state.user.activity;
    document.getElementById('calcDeficit').value = state.user.deficit;

    tdeeModalOverlay.classList.add('active');
    SoundFX.tap();
  }

  if (btnEditBudget) btnEditBudget.addEventListener('click', openTdeeModal);
  if (btnRecalculatePlan) btnRecalculatePlan.addEventListener('click', openTdeeModal);
  if (btnCloseTdeeModal) btnCloseTdeeModal.addEventListener('click', () => tdeeModalOverlay.classList.remove('active'));

  if (btnSaveTdeePlan) {
    btnSaveTdeePlan.addEventListener('click', () => {
      const gender = document.getElementById('calcGender').value;
      const age = parseInt(document.getElementById('calcAge').value, 10);
      const height = parseFloat(document.getElementById('calcHeight').value);
      const weight = parseFloat(document.getElementById('calcWeight').value);
      const targetWeight = parseFloat(document.getElementById('calcTargetWeight').value);
      const activity = parseFloat(document.getElementById('calcActivity').value);
      const deficit = parseInt(document.getElementById('calcDeficit').value, 10);

      // Mifflin-St Jeor 公式
      let bmr = 10 * weight + 6.25 * height - 5 * age;
      bmr += (gender === 'male' ? 5 : -161);

      const tdee = Math.round(bmr * activity);
      const targetCalorie = Math.max(1200, tdee - deficit); // 不低於安全基礎代謝

      // 更新狀態
      state.user.age = age;
      state.user.height = height;
      state.user.currentWeight = weight;
      state.user.targetWeight = targetWeight;
      state.user.activity = activity;
      state.user.deficit = deficit;
      state.goals.targetCalorie = targetCalorie;

      // 宏觀營養素配比：碳水 45%, 蛋白質 30%, 脂肪 25%
      state.goals.carbs = Math.round((targetCalorie * 0.45) / 4);
      state.goals.protein = Math.round((targetCalorie * 0.30) / 4);
      state.goals.fat = Math.round((targetCalorie * 0.25) / 9);

      // 更新個人資料面板
      const profileBio = document.getElementById('profileBioInfo');
      const profileTDEE = document.getElementById('profileTDEE');
      const profileRec = document.getElementById('profileRecIntake');
      const valBMR = document.getElementById('valBMR');

      if (profileBio) profileBio.textContent = `${height} cm · ${weight} kg · ${age}歲 (${gender === 'male' ? '男' : '女'})`;
      if (profileTDEE) profileTDEE.textContent = `${tdee.toLocaleString()} kcal/天`;
      if (profileRec) profileRec.textContent = `${targetCalorie.toLocaleString()} kcal`;
      if (valBMR) valBMR.textContent = Math.round(bmr).toLocaleString();

      tdeeModalOverlay.classList.remove('active');
      SoundFX.success();
      showToast(`🎯 已重算：建議每日攝入 ${targetCalorie} kcal（TDEE: ${tdee}）`);
      updateDashboardMetrics();
      saveState();
    });
  }

  /* ==========================================================================
     13. 成果打卡海報生成彈窗 (Share Poster Modal)
     ========================================================================== */
  const sharePosterModal = document.getElementById('sharePosterModal');
  const btnClosePosterModal = document.getElementById('btnClosePosterModal');
  const btnOpenShareCard = document.getElementById('btnOpenShareCard');
  const btnDownloadPoster = document.getElementById('btnDownloadPoster');
  const btnCopyPosterLink = document.getElementById('btnCopyPosterLink');

  if (btnOpenShareCard) {
    btnOpenShareCard.addEventListener('click', () => {
      sharePosterModal.classList.add('active');
      SoundFX.tap();
    });
  }

  if (btnClosePosterModal) {
    btnClosePosterModal.addEventListener('click', () => {
      sharePosterModal.classList.remove('active');
    });
  }

  if (btnDownloadPoster) {
    btnDownloadPoster.addEventListener('click', () => {
      SoundFX.success();
      showToast('📸 打卡海報已生成！正在為您下載高畫質圖片...');
    });
  }

  if (btnCopyPosterLink) {
    btnCopyPosterLink.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        SoundFX.tap();
        showToast('🔗 分享連結已複製到剪貼板！快發給減肥搭子吧');
      }).catch(() => {
        showToast('已生成分享短鏈接！');
      });
    });
  }

  /* ==========================================================================
     13.1 個人自訂資料與頭像更換引擎 (User Profile & Avatar Customization)
     ========================================================================== */
  const editProfileModalOverlay = document.getElementById('editProfileModalOverlay');
  const btnCloseEditProfileModal = document.getElementById('btnCloseEditProfileModal');
  const openProfileFromAvatar = document.getElementById('openProfileFromAvatar');
  const btnOpenEditAvatar = document.getElementById('btnOpenEditAvatar');
  const btnOpenEditProfileModal = document.getElementById('btnOpenEditProfileModal');
  const editAvatarPreviewImg = document.getElementById('editAvatarPreviewImg');
  const btnTriggerAvatarUpload = document.getElementById('btnTriggerAvatarUpload');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const presetAvatarItems = document.querySelectorAll('.preset-avatar-item');
  const avatarUrlInput = document.getElementById('avatarUrlInput');
  const editUserNameInput = document.getElementById('editUserNameInput');
  const editUserMottoInput = document.getElementById('editUserMottoInput');
  const btnSaveProfileCustom = document.getElementById('btnSaveProfileCustom');

  let currentEditingAvatarSrc = state.user.avatar;

  function updateUserProfileUI() {
    // 1. 儀表板頂部問候語與頭像
    const dashGreetingName = document.getElementById('dashGreetingName');
    const dashUserAvatar = document.getElementById('dashUserAvatar');
    if (dashGreetingName) {
      const hour = new Date().getHours();
      let greeting = '早安';
      if (hour >= 11 && hour < 14) greeting = '午安';
      else if (hour >= 14 && hour < 18) greeting = '下午好';
      else if (hour >= 18 || hour < 5) greeting = '晚安';
      dashGreetingName.textContent = `${greeting}，${state.user.name} 👋`;
    }
    if (dashUserAvatar) {
      dashUserAvatar.src = state.user.avatar;
    }

    // 2. 個人頁面姓名、頭像與座右銘
    const profileUserName = document.getElementById('profileUserName');
    const profileUserAvatar = document.getElementById('profileUserAvatar');
    const profileUserMotto = document.getElementById('profileUserMotto');
    if (profileUserName) {
      profileUserName.textContent = state.user.name;
    }
    if (profileUserAvatar) {
      profileUserAvatar.src = state.user.avatar;
    }
    if (profileUserMotto) {
      profileUserMotto.textContent = `「${state.user.motto}」`;
    }

    // 3. 打卡分享海報姓名與頭像
    const posterUserName = document.getElementById('posterUserName');
    const posterUserAvatar = document.getElementById('posterUserAvatar');
    if (posterUserName) {
      posterUserName.textContent = state.user.name;
    }
    if (posterUserAvatar) {
      posterUserAvatar.src = state.user.avatar;
    }
  }

  function openEditProfileModal() {
    if (!editProfileModalOverlay) return;

    currentEditingAvatarSrc = state.user.avatar;
    if (editAvatarPreviewImg) editAvatarPreviewImg.src = state.user.avatar;
    if (editUserNameInput) editUserNameInput.value = state.user.name;
    if (editUserMottoInput) editUserMottoInput.value = state.user.motto || '';
    if (avatarUrlInput) {
      avatarUrlInput.value = state.user.avatar.startsWith('data:') ? '' : state.user.avatar;
    }

    // 高亮預設風格頭像
    presetAvatarItems.forEach(item => {
      if (item.getAttribute('data-src') === state.user.avatar) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    editProfileModalOverlay.classList.add('active');
    SoundFX.tap();
  }

  // 綁定各處觸發開起自訂個人資料模態框
  [openProfileFromAvatar, btnOpenEditAvatar, btnOpenEditProfileModal].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        openEditProfileModal();
      });
    }
  });

  if (btnCloseEditProfileModal) {
    btnCloseEditProfileModal.addEventListener('click', () => {
      editProfileModalOverlay.classList.remove('active');
    });
  }

  // 點擊相機圖標觸發本機相片選擇
  if (btnTriggerAvatarUpload && avatarFileInput) {
    btnTriggerAvatarUpload.addEventListener('click', () => {
      avatarFileInput.click();
    });
  }

  // 讀取本機上傳圖片檔案並轉換為 Base64 DataURL
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('請選擇標準的圖片格式 (JPG, PNG, WebP)！', 'fa-solid fa-triangle-exclamation');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast('圖片檔案請勿超過 5MB！', 'fa-solid fa-triangle-exclamation');
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        currentEditingAvatarSrc = evt.target.result;
        if (editAvatarPreviewImg) editAvatarPreviewImg.src = currentEditingAvatarSrc;
        presetAvatarItems.forEach(item => item.classList.remove('active'));
        if (avatarUrlInput) avatarUrlInput.value = '';
        SoundFX.tap();
        showToast('📷 已讀取本地相片，點擊儲存即可套用！');
      };
      reader.readAsDataURL(file);
    });
  }

  // 點擊預設風格推薦頭像
  presetAvatarItems.forEach(item => {
    item.addEventListener('click', () => {
      presetAvatarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentEditingAvatarSrc = item.getAttribute('data-src');
      if (editAvatarPreviewImg) editAvatarPreviewImg.src = currentEditingAvatarSrc;
      if (avatarUrlInput) avatarUrlInput.value = '';
      SoundFX.tap();
    });
  });

  // 輸入網路圖片 URL
  if (avatarUrlInput) {
    avatarUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
        currentEditingAvatarSrc = url;
        if (editAvatarPreviewImg) editAvatarPreviewImg.src = url;
        presetAvatarItems.forEach(i => i.classList.remove('active'));
      }
    });
  }

  // 保存自訂個人資料按鈕
  if (btnSaveProfileCustom) {
    btnSaveProfileCustom.addEventListener('click', () => {
      const newName = editUserNameInput ? editUserNameInput.value.trim() : '';
      const newMotto = editUserMottoInput ? editUserMottoInput.value.trim() : '';

      if (!newName) {
        showToast('請填寫姓名或暱稱！', 'fa-solid fa-triangle-exclamation');
        if (editUserNameInput) editUserNameInput.focus();
        return;
      }

      state.user.name = newName;
      if (newMotto) state.user.motto = newMotto;
      if (currentEditingAvatarSrc) state.user.avatar = currentEditingAvatarSrc;

      updateUserProfileUI();
      saveState();

      if (editProfileModalOverlay) {
        editProfileModalOverlay.classList.remove('active');
      }

      SoundFX.success();
      showToast(`✨ 個人資料已更新！你好，${newName}`);
    });
  }

  /* ==========================================================================
     14. 懸浮加號按鈕 (Floating Action Button & Sub-options)
     ========================================================================== */
  const fabWrapper = document.getElementById('fabMenuWrapper');
  const mainFabBtn = document.getElementById('mainFabBtn');

  if (mainFabBtn && fabWrapper) {
    mainFabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fabWrapper.classList.toggle('open');
      SoundFX.tap();
    });

    document.addEventListener('click', (e) => {
      if (!fabWrapper.contains(e.target)) {
        fabWrapper.classList.remove('open');
      }
    });
  }

  // FAB 子按鈕快捷動作
  const fabAddFood = document.getElementById('fabAddFood');
  const fabAddWater = document.getElementById('fabAddWater');
  const fabAddWeight = document.getElementById('fabAddWeight');
  const fabAddWorkout = document.getElementById('fabAddWorkout');

  if (fabAddFood) {
    fabAddFood.addEventListener('click', () => {
      fabWrapper.classList.remove('open');
      openFoodModal('lunch');
    });
  }

  if (fabAddWater) {
    fabAddWater.addEventListener('click', () => {
      fabWrapper.classList.remove('open');
      addWater(250);
    });
  }

  if (fabAddWeight) {
    fabAddWeight.addEventListener('click', () => {
      fabWrapper.classList.remove('open');
      openWeightModal();
    });
  }

  if (fabAddWorkout) {
    fabAddWorkout.addEventListener('click', () => {
      fabWrapper.classList.remove('open');
      startWorkoutSession();
    });
  }

  /* ==========================================================================
     15. 外觀主題與設備模擬器切換 (Theme & Device Sizer)
     ========================================================================== */
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const deskLightBtn = document.getElementById('deskLightBtn');
  const deskDarkBtn = document.getElementById('deskDarkBtn');

  function setTheme(theme) {
    state.theme = theme;
    document.body.classList.add('zen-theme');
    saveState();
  }

  // 視圖模式切換 (手機端軟件 vs 設計稿全景落地頁)
  const btnModeApp = document.getElementById('btnModeApp');
  const btnModeLanding = document.getElementById('btnModeLanding');
  const landingContainer = document.getElementById('landingContainer');

  function setViewMode(mode) {
    if (mode === 'landing') {
      if (landingContainer) landingContainer.style.display = 'block';
      if (phoneWrapper) phoneWrapper.style.display = 'none';
      if (btnModeLanding) btnModeLanding.classList.add('active');
      if (btnModeApp) btnModeApp.classList.remove('active');
    } else {
      if (landingContainer) landingContainer.style.display = 'none';
      if (phoneWrapper) phoneWrapper.style.display = 'block';
      if (btnModeApp) btnModeApp.classList.add('active');
      if (btnModeLanding) btnModeLanding.classList.remove('active');
    }
    SoundFX.tap();
  }

  if (btnModeApp) btnModeApp.addEventListener('click', () => setViewMode('app'));
  if (btnModeLanding) btnModeLanding.addEventListener('click', () => setViewMode('landing'));

  // 從落地頁按鈕直接進入手機軟件體驗
  const btnLaunchAppFromLanding = document.getElementById('btnLaunchAppFromLanding');
  const btnHeroStartApp = document.getElementById('btnHeroStartApp');
  const btnCoachStartApp = document.getElementById('btnCoachStartApp');

  [btnLaunchAppFromLanding, btnHeroStartApp, btnCoachStartApp].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        setViewMode('app');
        showToast('🧘 歡迎進入 MindFit Zen 減脂助手！');
      });
    }
  });

  // 手機頂部聲音開關
  const mobileSoundToggle = document.getElementById('mobileSoundToggle');
  if (mobileSoundToggle) {
    mobileSoundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      mobileSoundToggle.innerHTML = state.soundEnabled ? `<i class="fa-solid fa-volume-high"></i>` : `<i class="fa-solid fa-volume-xmark"></i>`;
      showToast(state.soundEnabled ? '已開啟操作音效' : '已關閉操作音效');
      if (soundSwitch) soundSwitch.checked = state.soundEnabled;
      saveState();
    });
  }

  // 設備尺寸切換 (iPhone, Pixel, 全屏模式)
  const phoneWrapper = document.getElementById('phoneWrapper');
  const deviceBtns = document.querySelectorAll('.device-btn');

  deviceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      deviceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const size = btn.getAttribute('data-size');
      phoneWrapper.className = `phone-wrapper ${size}`;
      SoundFX.tap();
    });
  });

  // 靈動島展開/收起交互
  const dynamicIsland = document.getElementById('dynamicIsland');
  if (dynamicIsland) {
    dynamicIsland.addEventListener('click', () => {
      dynamicIsland.classList.toggle('expanded');
      SoundFX.tap();
    });
  }

  // 狀態欄時鐘實時走動
  function updateStatusClock() {
    const clockEl = document.getElementById('statusClock');
    if (!clockEl) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${mins}`;
  }
  setInterval(updateStatusClock, 1000);
  updateStatusClock();

  // 偏好設定開關
  const soundSwitch = document.getElementById('soundSwitch');
  if (soundSwitch) {
    soundSwitch.checked = state.soundEnabled;
    soundSwitch.addEventListener('change', (e) => {
      state.soundEnabled = e.target.checked;
      SoundFX.tap();
      showToast(state.soundEnabled ? '已開啟操作音效' : '已關閉操作音效');
      saveState();
    });
  }

  // 匯出 JSON 健康數據
  const rowExportData = document.getElementById('rowExportData');
  if (rowExportData) {
    rowExportData.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `SlimFit_Health_Data_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      SoundFX.success();
      showToast('📁 數據備份成功！已下載為 JSON 檔案');
    });
  }

  // 重置數據
  const resetDataBtn = document.getElementById('resetDataBtn');
  const rowResetAllData = document.getElementById('rowResetAllData');
  function resetAllData() {
    if (confirm('確定要將所有減脂飲食和體重紀錄還原為預設示範狀態嗎？')) {
      localStorage.removeItem('slimfit_state_v1');
      state = JSON.parse(JSON.stringify(defaultState));
      initApp();
      SoundFX.success();
      showToast('已恢復初始示範狀態！');
    }
  }

  if (resetDataBtn) resetDataBtn.addEventListener('click', resetAllData);
  if (rowResetAllData) rowResetAllData.addEventListener('click', resetAllData);

  /* ==========================================================================
     15.1 PWA 離線快取註冊與主畫面安裝提示 (PWA Registration & Install Engine)
     ========================================================================== */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker 註冊成功, scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker 註冊跳過或失敗:', err);
        });
    });
  }

  let deferredPwaPrompt = null;
  const pwaInstallBanner = document.getElementById('pwaInstallBanner');
  const btnInstallPWA = document.getElementById('btnInstallPWA');
  const btnClosePwaBanner = document.getElementById('btnClosePwaBanner');
  const btnHeaderInstall = document.getElementById('btnHeaderInstall');

  // 監聽原生 PWA 安裝提示事件 (Android Chrome / Edge / Desktop)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    if (pwaInstallBanner && sessionStorage.getItem('pwa_banner_dismissed') !== 'true') {
      pwaInstallBanner.style.display = 'flex';
    }
    if (btnHeaderInstall) {
      btnHeaderInstall.style.display = 'inline-flex';
    }
  });

  function triggerPwaInstall() {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      deferredPwaPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          showToast('🎉 感謝安裝 MindFit Zen！正在為您建立桌面圖示', 'fa-solid fa-download');
        }
        deferredPwaPrompt = null;
        if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
      });
    } else {
      openIosInstallGuide();
    }
  }

  if (btnInstallPWA) btnInstallPWA.addEventListener('click', triggerPwaInstall);
  if (btnHeaderInstall) btnHeaderInstall.addEventListener('click', triggerPwaInstall);

  if (btnClosePwaBanner) {
    btnClosePwaBanner.addEventListener('click', () => {
      if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
      sessionStorage.setItem('pwa_banner_dismissed', 'true');
    });
  }

  window.addEventListener('appinstalled', () => {
    if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
    if (btnHeaderInstall) btnHeaderInstall.style.display = 'none';
    showToast('🏆 MindFit Zen 已成功安裝至主畫面！', 'fa-solid fa-mobile-screen-button');
  });

  function openIosInstallGuide() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      alert('📱 如何在 iPhone 上安裝 MindFit Zen：\n1. 點擊 Safari 底部「分享」按鈕 (箭頭向上方框圖示)\n2. 往下滑動並選擇「加入主畫面」\n3. 點擊右上角「新增」，即可像原生 App 一樣全螢幕使用！');
    } else {
      showToast('提示：點擊瀏覽器右上角選單「安裝應用程式」或「加到主畫面」！', 'fa-solid fa-circle-info');
    }
  }

  /* ==========================================================================
     16. 應用初始化 (Bootstrap)
     ========================================================================== */
  function initApp() {
    setTheme(state.theme);
    updateUserProfileUI();
    updateDashboardMetrics();
    updateBodyStats();
    calcLiveBMI();
    renderWeightChart('7');
    renderWeightHistoryList();
    updateFastingClock();
  }

  initApp();

})();
