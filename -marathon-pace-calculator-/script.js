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
  const KEY_SPLITS = [5, 10, 15, 20, 21.0975, 25, 30, 35, 40, 41, 42, 42.195];

  // ---------- DOM Helpers ----------
  function $(selector) { return document.querySelector(selector); }
  function on(el, ev, cb) { if (!el) return; el.addEventListener(ev, cb); }
  function show(el) { el.classList.remove("hidden"); el.removeAttribute("hidden"); }
  function hide(el) { el.classList.add("hidden"); el.setAttribute("hidden", ""); }

  // ---------- Ripple Effect ----------
  function createRippleEffect(x, y, color = 'rgba(34, 197, 94, 0.3)') {
    // Create ripple element
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed;
      left: ${x - 10}px;
      top: ${y - 10}px;
      width: 20px;
      height: 20px;
      background: ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
      animation: ripple 0.6s ease-out forwards;
    `;
    
    // Add CSS animation if not already added
    if (!document.getElementById('ripple-animation')) {
      const style = document.createElement('style');
      style.id = 'ripple-animation';
      style.textContent = `
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);
  }

  function addRippleToElement(element, color = 'rgba(34, 197, 94, 0.3)') {
    element.addEventListener('click', function(e) {
      createRippleEffect(e.clientX, e.clientY, color);
    });
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
      
      this.init();
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
      
      // Click events for direct selection
      this.container.addEventListener('click', this.handleClick.bind(this));
    }
    
    handleStart(e) {
      this.isDragging = true;
      this.startY = this.getY(e);
      this.currentY = this.startY;
      this.velocity = 0;
      this.lastMoveTime = Date.now();
      this.hasMoved = false; // Track if user has actually dragged
      
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
      
      // Track if user has moved significantly (more than 5px)
      if (Math.abs(deltaY) > 5) {
        this.hasMoved = true;
      }
      
      this.velocity = deltaTime > 0 ? deltaY / deltaTime : 0;
      this.currentY = newY;
      this.lastMoveTime = currentTime;
      
      // Calculate index change based on movement
      const deltaIndex = Math.round(-deltaY / this.options.itemHeight);
      const newIndex = this.currentIndex + deltaIndex;
      
      // Update the transform directly for smooth dragging
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
      
      // Apply momentum
      if (Math.abs(this.velocity) > 0.5) {
        this.applyMomentum();
      } else {
        this.snapToNearest();
      }
    }
    
    handleClick(e) {
      // Only handle click if user hasn't dragged significantly
      if (this.hasMoved) {
        this.hasMoved = false;
        return;
      }
      
      // Get click position relative to container
      const rect = this.container.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      
      // Calculate which item was clicked
      const itemHeight = this.options.itemHeight;
      const containerHeight = this.container.clientHeight;
      
      // Find the item that was clicked
      const centerY = containerHeight / 2;
      const relativeY = clickY - centerY;
      // Fix: Use positive relativeY to get correct direction
      const clickedIndex = Math.round(relativeY / itemHeight) + this.currentIndex;
      
      // Clamp to valid range
      const maxIndex = this.options.data.length - 1;
      const newIndex = Math.max(0, Math.min(maxIndex, clickedIndex));
      
      // Add visual feedback
      createRippleEffect(e.clientX, e.clientY);
      
      // Update selection with smooth animation
      this.setIndex(newIndex);
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
  /**
   * 计算每公里负分割配速（前慢后快），保证总时间等于目标时间
   * @param {number} targetTotalSeconds - 目标完赛总秒数
   * @param {number} distanceKm - 比赛距离（km）
   * @param {number} strategySeconds - 策略幅度参数，单位：秒，代表最后一公里配速与起始配速的差值
   * @returns {number[]} 每公里配速数组，单位：秒
   */
  function calculateNegativeSplitPacesExact(targetTotalSeconds, distanceKm, strategySeconds) {
    const actualDistance = distanceKm;
    const t = targetTotalSeconds;
    
    // 使用数值方法求解起始配速
    // 设起始配速 = avgPace + offset，结束配速 = avgPace + offset - strategySeconds
    // 等差序列的总和应该等于 t
    
    const avgPace = t / actualDistance; // 平均配速
    
    let offset = 0;
    const tolerance = 0.001;
    let maxIterations = 1000;
    let iteration = 0;
    
    while (iteration < maxIterations) {
      const startPace = avgPace + offset;
      
      // 计算等差序列的总时间
      const n = Math.ceil(actualDistance);
      let totalTime = 0;
      
      for (let km = 1; km <= n; km++) {
        const progress = (km - 1) / (n - 1);
        const pace = startPace - strategySeconds * progress;
        totalTime += pace;
      }
      
      const error = totalTime - t;
      
      if (Math.abs(error) < tolerance) {
        break;
      }
      
      // 调整offset
      offset -= error / n;
      iteration++;
    }
    
    const startPace = avgPace + offset;
    const paces = [];
    const n = Math.ceil(actualDistance);
    
    // 根据等差序列计算每公里配速
    for (let km = 1; km <= n; km++) {
      const progress = (km - 1) / (n - 1);
      const pace = startPace - strategySeconds * progress;
      paces.push(pace);
    }
    
    // 修正最后一公里，使总和精确等于目标时间
    const sumPaces = paces.reduce((acc, val) => acc + val, 0);
    const correction = t - sumPaces;
    paces[paces.length - 1] += correction;
    
    return paces;
  }

  /**
   * 根据每公里配速计算关键里程的累计用时
   * @param {number[]} paces - 每公里配速数组（秒/km）
   * @param {number[]} keySplits - 关键里程数组
   * @returns {Array} 里程点累计时间和配速
   */
  function calculateSplitTimesFromPacesExact(paces, keySplits) {
    const splitTimes = [];

    keySplits.forEach(km => {
      let cumulativeTime = 0;

      // 累加整数公里
      for (let i = 0; i < Math.floor(km); i++) {
        cumulativeTime += paces[i];
      }

      // 小数部分修正
      if (km % 1 !== 0) {
        const frac = km - Math.floor(km);
        cumulativeTime += paces[Math.floor(km)] * frac;
      }

      // 当前里程点配速
      // 对于41km、42km和42.195km，使用最后一公里配速
      let currentPace;
      if (km === 41 || km === 42 || km === 42.195) {
        currentPace = paces[paces.length - 1];
      } else {
        currentPace = paces[Math.floor(km) - 1] || paces[paces.length - 1];
      }

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
  
  // Initialize ripple effects for all interactive elements
  function initRippleEffects() {
    // Add ripple effects to all buttons (green)
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      addRippleToElement(button, 'rgba(34, 197, 94, 0.3)');
    });
    
    // Add ripple effects to strategy option cards (blue)
    const strategyOptions = document.querySelectorAll('.strategy-option');
    strategyOptions.forEach(option => {
      addRippleToElement(option, 'rgba(59, 130, 246, 0.3)');
    });
    
    // Add ripple effects to scale marks (purple)
    const scaleMarks = document.querySelectorAll('.scale-mark');
    scaleMarks.forEach(mark => {
      addRippleToElement(mark, 'rgba(147, 51, 234, 0.3)');
    });
  }
  
  // Initialize ripple effects when DOM is ready
  initRippleEffects();
  
  const formPace = $("#form-pace");
  const splitsBody = $("#splits-body");
  const avgPaceEl = $("#avg-pace");
  const clearPaceBtn = $("#clear-pace");
  const negativeSplitWrapPace = $("#negative-split-wrap-pace");
  const scaleTrackPace = $("#scale-track-pace");
  const scalePointerPace = $("#scale-pointer-pace");
  const scaleValuePace = $("#scale-value-pace");
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
    return parseInt(scalePointerPace.dataset.value || '30');
  }

  // 刻度尺交互逻辑
  function updateScalePointer(element, value) {
    const percentage = (value / 60) * 100;
    element.style.left = `${percentage}%`;
    element.dataset.value = value;
    
    // 更新活跃状态
    const marks = element.parentElement.querySelectorAll('.scale-mark');
    marks.forEach(mark => {
      mark.classList.toggle('active', parseInt(mark.dataset.value) === value);
    });
  }

  // 初始化刻度尺
  updateScalePointer(scalePointerPace, 30);
  
  // 刻度尺点击事件
  on(scaleTrackPace, "click", (e) => {
    const rect = scaleTrackPace.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const value = Math.round(percentage * 60);
    const clampedValue = Math.max(0, Math.min(60, value));
    
    updateScalePointer(scalePointerPace, clampedValue);
    scaleValuePace.textContent = `${clampedValue} 秒/公里`;
  });

  // 圆形滑块拖拽功能
  let isDragging = false;
  
  on(scalePointerPace, "mousedown", (e) => {
    isDragging = true;
    e.preventDefault();
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    const rect = scaleTrackPace.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const value = Math.round(percentage * 60);
    const clampedValue = Math.max(0, Math.min(60, value));
    
    updateScalePointer(scalePointerPace, clampedValue);
    scaleValuePace.textContent = `${clampedValue} 秒/公里`;
  });
  
  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
  
  // 触摸事件支持
  on(scalePointerPace, "touchstart", (e) => {
    isDragging = true;
    e.preventDefault();
  });
  
  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    
    const rect = scaleTrackPace.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = x / rect.width;
    const value = Math.round(percentage * 60);
    const clampedValue = Math.max(0, Math.min(60, value));
    
    updateScalePointer(scalePointerPace, clampedValue);
    scaleValuePace.textContent = `${clampedValue} 秒/公里`;
  });
  
  document.addEventListener("touchend", () => {
    isDragging = false;
  });
  
  // 刻度标记点击事件
  const scaleMarksPace = scaleTrackPace.querySelectorAll('.scale-mark');
  scaleMarksPace.forEach(mark => {
    on(mark, "click", (e) => {
      e.stopPropagation();
      const value = parseInt(mark.dataset.value);
      updateScalePointer(scalePointerPace, value);
      scaleValuePace.textContent = `${value} 秒/公里`;
    });
  });

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

    let avgPace, splitTimes, showPaceColumn = false, paces;

    if (strategy === "negative") {
      // 负分割策略
      const strategyValue = getSelectedNegativeSplitValue();
      paces = calculateNegativeSplitPacesExact(totalSeconds, distanceKm, strategyValue);
      avgPace = totalSeconds / distanceKm; // 平均配速保持不变
      splitTimes = calculateSplitTimesFromPacesExact(paces, KEY_SPLITS.filter(km => km <= distanceKm + 1e-6));
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
      // 为匀速策略创建统一的配速数组
      const n = Math.ceil(distanceKm);
      paces = new Array(n).fill(avgPace);
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
    
    // 添加起跑点(0km)行
    const startTr = document.createElement("tr");
    const startTd1 = document.createElement("td");
    startTd1.textContent = "起跑点(0km)";
    startTr.appendChild(startTd1);
    
    if (showPaceColumn) {
      const startTd2 = document.createElement("td");
      startTd2.textContent = formatSecondsPerKm(paces[0]); // 起始配速
      startTr.appendChild(startTd2);
    }
    
    const startTd3 = document.createElement("td");
    startTd3.textContent = "0:00:00";
    startTr.appendChild(startTd3);
    
    body.appendChild(startTr);
    
    // 添加其他里程点
    splitTimes.forEach(({ distance, time, pace }) => {
      const tr = document.createElement("tr");
      
      // 里程点
      const td1 = document.createElement("td");
      td1.textContent = `${distance} km`;
      tr.appendChild(td1);
      
      // 参考配速（仅负分割策略显示）
      if (showPaceColumn) {
        const td2 = document.createElement("td");
        // 对于41km、42km和42.195km，使用最后一公里配速
        if (distance === 41 || distance === 42 || distance === 42.195) {
          td2.textContent = formatSecondsPerKm(paces[paces.length - 1]);
        } else {
          td2.textContent = formatSecondsPerKm(pace);
        }
        tr.appendChild(td2);
      }
      
      // 累计用时
      const td3 = document.createElement("td");
      // 对于42.195km，强制显示目标完赛时间
      if (distance === 42.195) {
        td3.textContent = formatSecondsToHms(totalSeconds);
      } else {
        td3.textContent = formatSecondsToHms(time);
      }
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
    updateScalePointer(scalePointerPace, 30);
    scaleValuePace.textContent = "30 秒/公里";
  });

  // removed old inline time picker code

})();


