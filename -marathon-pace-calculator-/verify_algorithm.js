/**
 * 验证新算法是否正确工作
 */

// 从主文件中复制算法进行测试
function calculateNegativeSplitPacesExact(targetTotalSeconds, distanceKm, strategySeconds) {
  const actualDistance = distanceKm;
  const t = targetTotalSeconds;
  
  const avgPace = t / actualDistance;
  
  let offset = 0;
  const tolerance = 0.001;
  let maxIterations = 1000;
  let iteration = 0;
  
  while (iteration < maxIterations) {
    const startPace = avgPace + offset;
    
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
    
    offset -= error / n;
    iteration++;
  }
  
  const startPace = avgPace + offset;
  const paces = [];
  const n = Math.ceil(actualDistance);
  
  for (let km = 1; km <= n; km++) {
    const progress = (km - 1) / (n - 1);
    const pace = startPace - strategySeconds * progress;
    paces.push(pace);
  }
  
  const sumPaces = paces.reduce((acc, val) => acc + val, 0);
  const correction = t - sumPaces;
  paces[paces.length - 1] += correction;
  
  return paces;
}

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

function formatSecondsPerKm(secPerKm) {
  if (!Number.isFinite(secPerKm)) return "—";
  const s = Math.round(secPerKm);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")} /km`;
}

// 验证测试
console.log("=== 新算法验证测试 ===");
console.log("新定义：strategySeconds = 最后一公里配速 - 起始配速\n");

// 测试1：半程马拉松，策略20秒
console.log("测试1：半程马拉松，目标时间1:30:00，策略20秒");
const test1 = calculateNegativeSplitPacesExact(5400, 21.0975, 20);
const total1 = test1.reduce((sum, pace) => sum + pace, 0);
const actualStrategy1 = test1[0] - test1[test1.length - 1];
console.log(`起始配速: ${formatSecondsPerKm(test1[0])}`);
console.log(`最后一公里配速: ${formatSecondsPerKm(test1[test1.length - 1])}`);
console.log(`设定策略差值: 20 秒`);
console.log(`实际策略差值: ${Math.round(actualStrategy1)} 秒`);
console.log(`总时间: ${formatSecondsToHms(total1)}`);
console.log(`时间误差: ${Math.abs(total1 - 5400)} 秒`);
console.log("");

// 测试2：全程马拉松，策略30秒
console.log("测试2：全程马拉松，目标时间4:00:00，策略30秒");
const test2 = calculateNegativeSplitPacesExact(14400, 42.195, 30);
const total2 = test2.reduce((sum, pace) => sum + pace, 0);
const actualStrategy2 = test2[0] - test2[test2.length - 1];
console.log(`起始配速: ${formatSecondsPerKm(test2[0])}`);
console.log(`最后一公里配速: ${formatSecondsPerKm(test2[test2.length - 1])}`);
console.log(`设定策略差值: 30 秒`);
console.log(`实际策略差值: ${Math.round(actualStrategy2)} 秒`);
console.log(`总时间: ${formatSecondsToHms(total2)}`);
console.log(`时间误差: ${Math.abs(total2 - 14400)} 秒`);
console.log("");

// 测试3：全程马拉松，策略15秒
console.log("测试3：全程马拉松，目标时间3:30:00，策略15秒");
const test3 = calculateNegativeSplitPacesExact(12600, 42.195, 15);
const total3 = test3.reduce((sum, pace) => sum + pace, 0);
const actualStrategy3 = test3[0] - test3[test3.length - 1];
console.log(`起始配速: ${formatSecondsPerKm(test3[0])}`);
console.log(`最后一公里配速: ${formatSecondsPerKm(test3[test3.length - 1])}`);
console.log(`设定策略差值: 15 秒`);
console.log(`实际策略差值: ${Math.round(actualStrategy3)} 秒`);
console.log(`总时间: ${formatSecondsToHms(total3)}`);
console.log(`时间误差: ${Math.abs(total3 - 12600)} 秒`);
console.log("");

// 总结
const timeErrors = [Math.abs(total1 - 5400), Math.abs(total2 - 14400), Math.abs(total3 - 12600)];
const strategyErrors = [Math.abs(actualStrategy1 - 20), Math.abs(actualStrategy2 - 30), Math.abs(actualStrategy3 - 15)];

const maxTimeError = Math.max(...timeErrors);
const maxStrategyError = Math.max(...strategyErrors);

console.log("=== 验证结果总结 ===");
console.log(`最大时间误差: ${maxTimeError} 秒`);
console.log(`最大策略误差: ${maxStrategyError} 秒`);
console.log(`时间精度测试: ${maxTimeError < 0.1 ? "✓ 通过" : "✗ 失败"}`);
console.log(`策略精度测试: ${maxStrategyError < 0.1 ? "✓ 通过" : "✗ 失败"}`);

if (maxTimeError < 0.1 && maxStrategyError < 0.1) {
  console.log("✓ 新算法替换成功！");
  console.log("✓ 时间精度和策略精度都达到要求");
} else {
  console.log("✗ 算法存在问题，需要进一步调试");
}

