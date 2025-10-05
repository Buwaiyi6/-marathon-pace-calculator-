(function () {
  "use strict";

  // ---------- Utilities ----------
  /** Parse time string like HH:MM:SS or H:MM into total seconds */
  function parseHmsToSeconds(input) {
    if (!input || typeof input !== "string") return NaN;
    const parts = input.trim().split(":").map((p) => p.trim());
    if (parts.some((p) => p === "")) return NaN;
    if (parts.length === 3) {
      const [h, m, s] = parts.map(Number);
      if ([h, m, s].some((v) => Number.isNaN(v) || v < 0)) return NaN;
      if (m >= 60 || s >= 60) return NaN;
      return h * 3600 + m * 60 + s;
    }
    if (parts.length === 2) {
      // accept M:S as total seconds as well (used in pace field sometimes typed like 300:00)
      const [a, b] = parts.map(Number);
      if ([a, b].some((v) => Number.isNaN(v) || v < 0)) return NaN;
      if (b >= 60) return NaN;
      return a * 60 + b;
    }
    return NaN;
  }

  /** Format seconds to HH:MM:SS */
  function formatSecondsToHms(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
    const s = Math.round(totalSeconds);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return [hours, minutes, seconds]
      .map((v, i) => (i === 0 ? String(v) : String(v).padStart(2, "0")))
      .join(":");
  }

  /** Format seconds per km to M:SS /km */
  function formatSecondsPerKm(secPerKm) {
    if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
    const s = Math.round(secPerKm);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")} /km`;
  }

  /** Clamp number */
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  // ---------- Distances ----------
  const DISTANCES = {
    full: 42.195,
    half: 21.0975,
  };
  const KEY_SPLITS = [5, 10, 15, 20, 21.0975, 25, 30, 35, 40, 42.195];

  // ---------- DOM Helpers ----------
  function $(selector) { return document.querySelector(selector); }
  function on(el, ev, cb) { if (!el) return; el.addEventListener(ev, cb); }
  function show(el) { el.classList.remove("hidden"); el.removeAttribute("hidden"); }
  function hide(el) { el.classList.add("hidden"); el.setAttribute("hidden", ""); }

  // ---------- Tabs ----------
  const tabPace = $("#tab-pace");
  const tabPredict = $("#tab-predict");
  const panelPace = $("#panel-pace");
  const panelPredict = $("#panel-predict");

  on(tabPace, "click", () => switchTab("pace"));
  on(tabPredict, "click", () => switchTab("predict"));

  function switchTab(which) {
    const isPace = which === "pace";
    tabPace.classList.toggle("active", isPace);
    tabPredict.classList.toggle("active", !isPace);
    panelPace.classList.toggle("active", isPace);
    panelPredict.classList.toggle("active", !isPace);
    if (isPace) {
      panelPace.removeAttribute("hidden");
      panelPredict.setAttribute("hidden", "");
    } else {
      panelPredict.removeAttribute("hidden");
      panelPace.setAttribute("hidden", "");
    }
  }

  // ---------- Time Picker (Wheel Picker) ----------
  class WheelPicker {
    constructor(container, options) {
      this.container = container;
      this.options = options;
      this.currentIndex = options.initialIndex || 0;
      this.isDragging = false;
      this.startY = 0;
      this.currentY = 0;
      this.velocity = 0;
      this.lastMoveTime = 0;
      this.animationId = null;
      
      // Mobile-specific properties
      this.isMobile = this.detectMobile();
      this.isClick = false;
      this.clickStartTime = 0;
      this.clickStartY = 0;
      
      this.init();
    }
    
    // 检测是否为移动设备
    detectMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
             ('ontouchstart' in window) || 
             (navigator.maxTouchPoints > 0);
    }
    
    init() {
      this.createWheel();
      this.bindEvents();
      this.updateSelection();
      this.centerSelectedItem();
    }
    
    createWheel() {
      const wheelList = document.createElement('div');
      wheelList.className = 'wheel-list';
      this.wheelList = wheelList;
      
      // Add selection indicator
      const selection = document.createElement('div');
      selection.className = 'wheel-selection';
      this.container.appendChild(selection);
      
      // Create wheel items
      this.options.data.forEach((item, index) => {
        const wheelItem = document.createElement('div');
        wheelItem.className = 'wheel-item';
        wheelItem.textContent = item;
        wheelItem.dataset.index = index;
        
        // 只在移动端添加点击事件
        if (this.isMobile) {
          wheelItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleItemClick(index);
          });
        }
        
        wheelList.appendChild(wheelItem);
      });
      
      this.container.appendChild(wheelList);
    }
    
    bindEvents() {
      // Mouse events
      this.container.addEventListener('mousedown', this.handleStart.bind(this));
      document.addEventListener('mousemove', this.handleMove.bind(this));
      document.addEventListener('mouseup', this.handleEnd.bind(this));
      
      // Touch events
      this.container.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
      document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
      document.addEventListener('touchend', this.handleEnd.bind(this));
      
      // Wheel events
      this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
      
      // 移动端阻止长按上下文菜单
      if (this.isMobile) {
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
      }
    }
    
    handleStart(e) {
      this.isDragging = true;
      this.startY = this.getY(e);
      this.currentY = this.startY;
      this.velocity = 0;
      this.lastMoveTime = Date.now();
      
      // 移动端点击检测
      if (this.isMobile) {
        this.isClick = true;
        this.clickStartTime = Date.now();
        this.clickStartY = this.startY;
      }
      
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      e.preventDefault();
    }
    
    handleMove(e) {
      if (!this.isDragging) return;
      
      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastMoveTime;
      const newY = this.getY(e);
      const deltaY = newY - this.currentY;
      
      // 移动端点击检测
      if (this.isMobile) {
        const totalMovement = Math.abs(newY - this.clickStartY);
        if (totalMovement > 10) {
          this.isClick = false;
        }
      }
      
      this.velocity = deltaTime > 0 ? deltaY / deltaTime : 0;
      this.currentY = newY;
      this.lastMoveTime = currentTime;
      
      // 电脑端保持原有逻辑
      if (!this.isMobile) {
        // Calculate index change based on movement
        const deltaIndex = Math.round(-deltaY / this.options.itemHeight);
        const newIndex = this.currentIndex + deltaIndex;
      }
      
      // 移动端和电脑端都使用跟随滑动
      const currentTransform = this.getCenteredTransform();
      const newTransform = currentTransform - deltaY;
      this.wheelList.style.transform = `translateY(${newTransform}px)`;
      
      // Update selection based on which item is in the center
      this.updateSelectionFromTransform(newTransform);
      
      e.preventDefault();
    }
    
    handleEnd() {
      if (!this.isDragging) return;
      
      this.isDragging = false;
      
      // 移动端特殊处理
      if (this.isMobile) {
        const clickDuration = Date.now() - this.clickStartTime;
        const totalMovement = Math.abs(this.currentY - this.clickStartY);
        
        // 判断是点击还是拖拽
        if (this.isClick && clickDuration < 300 && totalMovement < 10) {
          // 点击操作：磁吸锁定到最近的数字
          this.snapToNearest();
        } else {
          // 拖拽操作：应用惯性或直接归位
          if (Math.abs(this.velocity) > 0.5) {
            this.applyMomentum();
          } else {
            this.snapToNearest();
          }
        }
      } else {
        // 电脑端保持原有逻辑
        if (Math.abs(this.velocity) > 0.5) {
          this.applyMomentum();
        } else {
          this.snapToNearest();
        }
      }
    }
    
    // 移动端点击数字项目处理
    handleItemClick(index) {
      if (!this.isMobile) return;
      
      this.setIndex(index);
      this.snapToNearest();
    }
    
    updateSelectionFromTransform(transform) {
      const containerHeight = this.container.clientHeight;
      const itemHeight = this.options.itemHeight;
      
      // Calculate which item is currently in the center
      const centerY = containerHeight / 2;
      const itemY = centerY - transform;
      const index = Math.round(itemY / itemHeight);
      
      // Update current index if it changed
      if (index !== this.currentIndex && index >= 0 && index < this.options.data.length) {
        this.currentIndex = index;
        this.updateSelection();
      }
    }
    
    handleWheel(e) {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 1 : -1;
      this.setIndex(this.currentIndex + delta);
      this.snapToNearest();
    }
    
    getY(e) {
      return e.touches ? e.touches[0].clientY : e.clientY;
    }
    
    setIndex(index) {
      const maxIndex = this.options.data.length - 1;
      const newIndex = Math.max(0, Math.min(maxIndex, index));
      if (newIndex !== this.currentIndex) {
        this.currentIndex = newIndex;
        this.updateTransform();
        this.dispatchChangeEvent();
      }
    }
    
    dispatchChangeEvent() {
      const event = new CustomEvent('wheel-change', {
        detail: { value: this.getValue(), index: this.currentIndex }
      });
      this.container.dispatchEvent(event);
    }
    
    updateTransform() {
      const translateY = this.getCenteredTransform();
      this.wheelList.style.transform = `translateY(${translateY}px)`;
      this.updateSelection();
    }
    
    getCenteredTransform() {
      // Calculate the transform to center the selected item
      const containerHeight = this.container.clientHeight;
      const itemHeight = this.options.itemHeight;
      const selectedItemOffset = this.currentIndex * itemHeight;
      
      // Center the selected item in the container
      return (containerHeight / 2) - (itemHeight / 2) - selectedItemOffset;
    }
    
    centerSelectedItem() {
      // Initial positioning to center the selected item
      const translateY = this.getCenteredTransform();
      this.wheelList.style.transform = `translateY(${translateY}px)`;
    }
    
    updateSelection() {
      const items = this.wheelList.querySelectorAll('.wheel-item');
      items.forEach((item, index) => {
        const distance = Math.abs(index - this.currentIndex);
        item.classList.toggle('selected', index === this.currentIndex);
        item.classList.toggle('fade', distance > 2);
      });
    }
    
    snapToNearest() {
      const targetY = this.getCenteredTransform();
      this.wheelList.style.transform = `translateY(${targetY}px)`;
      this.updateSelection();
    }
    
    applyMomentum() {
      const momentum = this.velocity * 100;
      const targetIndex = this.currentIndex + Math.round(momentum);
      this.setIndex(targetIndex);
      
      // Smooth animation to target
      const startTime = Date.now();
      const duration = 300;
      const startY = this.getCenteredTransform();
      
      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const targetY = this.getCenteredTransform();
        const currentY = startY + (targetY - startY) * easeOut;
        this.wheelList.style.transform = `translateY(${currentY}px)`;
        
        if (progress < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.updateSelection();
        }
      };
      
      this.animationId = requestAnimationFrame(animate);
    }
    
    getValue() {
      return this.options.data[this.currentIndex];
    }
    
    setValue(value) {
      const index = this.options.data.indexOf(value);
      if (index !== -1) {
        this.setIndex(index);
      }
    }
  }

  // ---------- Negative Split Calculation Functions ----------
  function calculateNegativeSplitPaces(targetTotalSeconds, distance, strategyValue) {
    const targetPacePerKm = targetTotalSeconds / distance;
    const paces = [];
    
    for (let km = 1; km <= distance; km++) {
      const progress = (km - 1) / (distance - 1);
      
      // 使用二次函数实现平滑加速曲线
      const paceAdjustment = strategyValue * (1 - 2 * progress + progress * progress);
      const paceForThisKm = targetPacePerKm + paceAdjustment;
      
      paces.push(paceForThisKm);
    }
    
    return paces;
  }

  function calculateSplitTimesFromPaces(paces, keySplits) {
    const splitTimes = [];
    
    keySplits.forEach(km => {
      let cumulativeTime = 0;
      
      // 整数公里部分
      for (let i = 0; i < Math.floor(km); i++) {
        cumulativeTime += paces[i];
      }
      
      // 小数部分处理
      if (km % 1 !== 0) {
        const fractionalPart = km - Math.floor(km);
        const nextPace = paces[Math.floor(km)] || paces[paces.length - 1];
        cumulativeTime += nextPace * fractionalPart;
      }
      
      // 获取当前里程点的配速
      const currentPace = paces[Math.floor(km) - 1] || paces[paces.length - 1];
      
      splitTimes.push({
        distance: km,
        time: cumulativeTime,
        pace: currentPace
      });
    });
    
    return splitTimes;
  }

  // ---------- Pace Calculation Mode ----------
  let hourPicker, minutePicker, secondPicker;
  let currentTime = { hour: 1, minute: 0, second: 0 };
  
  // Initialize embedded wheel picker
  function initTimePicker() {
    // Create hour data (1-7)
    const hourData = ['1', '2', '3', '4', '5', '6', '7'];
    
    // Create minute/second data (00-59)
    const timeData = Array.from({ length: 60 }, (_, i) => 
      String(i).padStart(2, '0')
    );
    
    hourPicker = new WheelPicker($("#hour-wheel"), {
      data: hourData,
      itemHeight: 36,
      initialIndex: 0
    });
    
    minutePicker = new WheelPicker($("#minute-wheel"), {
      data: timeData,
      itemHeight: 36,
      initialIndex: 0
    });
    
    secondPicker = new WheelPicker($("#second-wheel"), {
      data: timeData,
      itemHeight: 36,
      initialIndex: 0
    });
    
    // Bind wheel picker change events
    hourPicker.container.addEventListener('wheel-change', () => {
      currentTime.hour = parseInt(hourPicker.getValue());
    });
    
    minutePicker.container.addEventListener('wheel-change', () => {
      currentTime.minute = parseInt(minutePicker.getValue());
    });
    
    secondPicker.container.addEventListener('wheel-change', () => {
      currentTime.second = parseInt(secondPicker.getValue());
    });
  }
  
  // Initialize time picker when DOM is ready
  initTimePicker();
  
  const formPace = $("#form-pace");
  const splitsBody = $("#splits-body");
  const avgPaceEl = $("#avg-pace");
  const clearPaceBtn = $("#clear-pace");
  const negativeSplitWrapPace = $("#negative-split-wrap-pace");
  const negativeSplitRadiosPace = document.getElementsByName("negative-split-pace");
  const paceColumnHeader = $("#pace-column-header");

  const strategyPaceRadios = document.getElementsByName("strategy-pace");
  strategyPaceRadios.forEach((r) => r.addEventListener("change", () => {
    const isNegative = getCheckedValue(strategyPaceRadios) === "negative";
    if (isNegative) show(negativeSplitWrapPace); else hide(negativeSplitWrapPace);
  }));
  
  // 初始化负分割策略选择区域显示状态
  const isNegativePace = getCheckedValue(strategyPaceRadios) === "negative";
  if (isNegativePace) show(negativeSplitWrapPace); else hide(negativeSplitWrapPace);

  // 获取选中的负分割策略值
  function getSelectedNegativeSplitValue() {
    for (const radio of negativeSplitRadiosPace) {
      if (radio.checked) {
        return parseInt(radio.value);
      }
    }
    return 10; // 默认标准策略
  }

  function getCheckedValue(nodeList) {
    for (const n of nodeList) { if (n.checked) return n.value; }
    return null;
  }

  // Old input bindings removed - now using wheel picker

  on(formPace, "submit", (e) => {
    e.preventDefault();

    // Get time from wheel picker
    const h = currentTime.hour;
    const m = currentTime.minute;
    const s = currentTime.second;
    
    if ([h, m, s].some((v) => Number.isNaN(v) || v < 0) || m >= 60 || s >= 60 || h < 1 || h > 7) {
      alert("请输入有效的目标时间（小时1-7，分秒0-59）");
      return;
    }
    const totalSeconds = h * 3600 + m * 60 + s;

    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      alert("请输入有效的目标时间");
      return;
    }

    const raceValue = getCheckedValue(document.getElementsByName("race"));
    const distanceKm = raceValue === "half" ? DISTANCES.half : DISTANCES.full;
    const strategy = getCheckedValue(strategyPaceRadios);

    let avgPace, splitTimes, showPaceColumn = false;

    if (strategy === "negative") {
      // 负分割策略
      const strategyValue = getSelectedNegativeSplitValue();
      const paces = calculateNegativeSplitPaces(totalSeconds, distanceKm, strategyValue);
      avgPace = totalSeconds / distanceKm; // 平均配速保持不变
      splitTimes = calculateSplitTimesFromPaces(paces, KEY_SPLITS.filter(km => km <= distanceKm + 1e-6));
      showPaceColumn = true;
    } else {
      // 匀速策略
      avgPace = totalSeconds / distanceKm;
      const filteredSplits = KEY_SPLITS.filter((km) => km <= distanceKm + 1e-6);
      splitTimes = filteredSplits.map(km => ({
        distance: km,
        time: avgPace * km,
        pace: avgPace
      }));
      showPaceColumn = false;
    }

    // 显示或隐藏参考配速列
    if (showPaceColumn) {
      show(paceColumnHeader);
    } else {
      hide(paceColumnHeader);
    }

    // 显示结果
    avgPaceEl.textContent = formatSecondsPerKm(avgPace);

    // 构建并显示关键节点时间表格
    const body = document.createDocumentFragment();
    splitTimes.forEach(({ distance, time, pace }) => {
      const tr = document.createElement("tr");
      
      // 里程点
      const td1 = document.createElement("td");
      td1.textContent = `${distance} km`;
      tr.appendChild(td1);
      
      // 参考配速（仅负分割策略显示）
      if (showPaceColumn) {
        const td2 = document.createElement("td");
        td2.textContent = formatSecondsPerKm(pace);
        tr.appendChild(td2);
      }
      
      // 累计用时
      const td3 = document.createElement("td");
      td3.textContent = formatSecondsToHms(time);
      tr.appendChild(td3);
      
      body.appendChild(tr);
    });
    splitsBody.innerHTML = "";
    splitsBody.appendChild(body);
  });

  on(clearPaceBtn, "click", () => {
    formPace.reset();
    avgPaceEl.textContent = "—";
    splitsBody.innerHTML = '<tr><td colspan="3" class="muted">暂无数据</td></tr>';
    hide(negativeSplitWrapPace);
    hide(paceColumnHeader);
    
    // Reset time picker to default
    currentTime = { hour: 1, minute: 0, second: 0 };
    hourPicker.setValue(String(currentTime.hour));
    minutePicker.setValue(String(currentTime.minute).padStart(2, '0'));
    secondPicker.setValue(String(currentTime.second).padStart(2, '0'));
    
    // Reset negative split strategy selection to default
    document.querySelector('input[name="negative-split-pace"][value="10"]').checked = true;
  });

  // removed old inline time picker code

  // ---------- Predict Mode ----------
  let paceMinutePicker, paceSecondPicker;
  let currentPace = { minute: 5, second: 0 };
  
  const formPredict = $("#form-predict");
  const predictBody = $("#predict-body");
  const clearPredictBtn = $("#clear-predict");
  const negativeSplitWrapPredict = $("#negative-split-wrap-predict");
  const negativeSplitRadiosPredict = document.getElementsByName("negative-split-predict");
  const strategyPredictRadios = document.getElementsByName("strategy-predict");
  
  // Initialize pace wheel picker
  function initPacePicker() {
    // Create minute data (1-10)
    const minuteData = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    
    // Create second data (00-59)
    const secondData = Array.from({ length: 60 }, (_, i) => 
      String(i).padStart(2, '0')
    );
    
    paceMinutePicker = new WheelPicker($("#pace-minute-wheel"), {
      data: minuteData,
      itemHeight: 36,
      initialIndex: 4 // Default to 5 minutes
    });
    
    paceSecondPicker = new WheelPicker($("#pace-second-wheel"), {
      data: secondData,
      itemHeight: 36,
      initialIndex: 0 // Default to 0 seconds
    });
    
    // Bind pace wheel picker change events
    paceMinutePicker.container.addEventListener('wheel-change', () => {
      currentPace.minute = parseInt(paceMinutePicker.getValue());
    });
    
    paceSecondPicker.container.addEventListener('wheel-change', () => {
      currentPace.second = parseInt(paceSecondPicker.getValue());
    });
  }
  
  // Initialize pace picker when DOM is ready
  initPacePicker();

  strategyPredictRadios.forEach((r) => r.addEventListener("change", () => {
    const isNegative = getCheckedValue(strategyPredictRadios) === "negative";
    if (isNegative) show(negativeSplitWrapPredict); else hide(negativeSplitWrapPredict);
  }));
  
  // 初始化负分割策略选择区域显示状态（成绩推测模式）
  const isNegativePredict = getCheckedValue(strategyPredictRadios) === "negative";
  if (isNegativePredict) show(negativeSplitWrapPredict); else hide(negativeSplitWrapPredict);

  // 获取选中的负分割策略值（成绩推测模式）
  function getSelectedNegativeSplitValuePredict() {
    for (const radio of negativeSplitRadiosPredict) {
      if (radio.checked) {
        return parseInt(radio.value);
      }
    }
    return 10; // 默认标准策略
  }

  // Old pace input bindings removed - now using wheel picker

  on(formPredict, "submit", (e) => {
    e.preventDefault();

    // Get pace from wheel picker
    const m = currentPace.minute;
    const s = currentPace.second;
    
    if ([m, s].some((v) => Number.isNaN(v) || v < 0) || s >= 60 || m < 1 || m > 10) {
      alert("请输入有效的配速（分钟1-10，秒0-59）");
      return;
    }
    
    const secPerKm = m * 60 + s;

    if (!Number.isFinite(secPerKm) || secPerKm <= 0) {
      alert("请输入有效的配速");
      return;
    }

    const strategy = getCheckedValue(strategyPredictRadios);

    const items = [
      { label: "10 公里", km: 10 },
      { label: "半程马拉松", km: 21.0975 },
      { label: "全程马拉松", km: 42.195 },
    ];

    const body = document.createDocumentFragment();
    items.forEach(({ label, km }) => {
      let predictedTime;
      
      if (strategy === "negative") {
        // 负分割策略：计算每公里持续变快的配速
        const strategyValue = getSelectedNegativeSplitValuePredict();
        const paces = calculateNegativeSplitPaces(secPerKm * km, km, strategyValue);
        predictedTime = paces.reduce((sum, pace) => sum + pace, 0);
      } else {
        // 匀速策略
        predictedTime = secPerKm * km;
      }
      
      const tr = document.createElement("tr");
      const td1 = document.createElement("td"); 
      td1.textContent = label;
      const td2 = document.createElement("td"); 
      td2.textContent = formatSecondsToHms(predictedTime);
      tr.appendChild(td1); 
      tr.appendChild(td2);
      body.appendChild(tr);
    });
    predictBody.innerHTML = "";
    predictBody.appendChild(body);
  });

  on(clearPredictBtn, "click", () => {
    formPredict.reset();
    predictBody.innerHTML = '<tr><td colspan="2" class="muted">暂无数据</td></tr>';
    hide(negativeSplitWrapPredict);
    
    // Reset pace picker to default
    currentPace = { minute: 5, second: 0 };
    paceMinutePicker.setValue(String(currentPace.minute));
    paceSecondPicker.setValue(String(currentPace.second).padStart(2, '0'));
    
    // Reset negative split strategy selection to default
    document.querySelector('input[name="negative-split-predict"][value="10"]').checked = true;
  });
})();


