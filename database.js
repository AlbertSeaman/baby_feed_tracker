// database.js - 完整版本（适用于Expo SDK 50+）
import * as SQLite from 'expo-sqlite';

// 数据库实例
let db = null;

// 获取本地时间字符串的函数
const getLocalDateTime = () => {
  const now = new Date();
  // 格式化为 YYYY-MM-DD HH:MM:SS
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 初始化数据库
export const initDatabase = async () => {
  try {
    if (!db) {
      // 使用新的异步API打开数据库
      db = await SQLite.openDatabaseAsync('babyRecords.db');
      console.log('✅ 数据库已打开');
    }
    
    // 创建喂奶记录表
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS feedings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        amount INTEGER,
        type TEXT,
        notes TEXT
      );
    `);
    
    // 创建大小便记录表
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS diapers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT,
        notes TEXT
      );
    `);
    
    console.log('✅ 数据库表已初始化');
    return db;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};

// 添加喂奶记录
export const addFeeding = async (amount, type, notes = '') => {
  try {
    if (!db) await initDatabase();
    
    const localTime = getLocalDateTime();
    
    const result = await db.runAsync(
      'INSERT INTO feedings (amount, type, notes, timestamp) VALUES (?, ?, ?, ?)',
      [amount, type, notes, localTime]
    );
    console.log('✅ 喂奶记录已保存, ID:', result.lastInsertRowId, '时间:', localTime);
    return result;
  } catch (error) {
    console.error('❌ 保存喂奶记录失败:', error);
    throw error;
  }
};

// 添加大小便记录
export const addDiaper = async (type, notes = '') => {
  try {
    if (!db) await initDatabase();
    
    const localTime = getLocalDateTime();
    
    const result = await db.runAsync(
      'INSERT INTO diapers (type, notes, timestamp) VALUES (?, ?, ?)',
      [type, notes, localTime]
    );
    console.log('✅ 大小便记录已保存, ID:', result.lastInsertRowId, '时间:', localTime);
    return result;
  } catch (error) {
    console.error('❌ 保存大小便记录失败:', error);
    throw error;
  }
};

// 获取今日统计和最近记录
export const getTodayStats = async () => {
  try {
    if (!db) await initDatabase();
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 获取今日喂奶统计
    const feedingsResult = await db.getAllAsync(
      `SELECT COUNT(*) as count, SUM(amount) as total FROM feedings WHERE date(timestamp) = ?`,
      [today]
    );
    const feedings = feedingsResult[0] || { count: 0, total: 0 };
    
    // 获取今日大小便统计
    const diapersResult = await db.getAllAsync(
      `SELECT 
        SUM(CASE WHEN type='小便' OR type='两者都有' THEN 1 ELSE 0 END) as peeCount,
        SUM(CASE WHEN type='大便' OR type='两者都有' THEN 1 ELSE 0 END) as poopCount
       FROM diapers WHERE date(timestamp) = ?`,
      [today]
    );
    const diapers = diapersResult[0] || { peeCount: 0, poopCount: 0 };
    
    // 获取最近5条喂奶记录
    const recentFeedings = await db.getAllAsync(
      `SELECT * FROM feedings ORDER BY timestamp DESC LIMIT 5`
    );
    
    // 获取最近5条大小便记录
    const recentDiapers = await db.getAllAsync(
      `SELECT * FROM diapers ORDER BY timestamp DESC LIMIT 5`
    );
    
    return {
      today: {
        feedings: feedings.count || 0,
        totalMilk: feedings.total || 0,
        pee: diapers.peeCount || 0,
        poop: diapers.poopCount || 0
      },
      recentFeedings: recentFeedings || [],
      recentDiapers: recentDiapers || []
    };
  } catch (error) {
    console.error('❌ 获取今日统计失败:', error);
    return {
      today: { feedings: 0, totalMilk: 0, pee: 0, poop: 0 },
      recentFeedings: [],
      recentDiapers: []
    };
  }
};

// 获取所有历史记录
export const getAllHistory = async () => {
  try {
    if (!db) await initDatabase();
    
    const history = await db.getAllAsync(`
      SELECT 
        'feeding' as recordType, 
        id,
        timestamp, 
        amount, 
        type, 
        notes
      FROM feedings 
      UNION ALL
      SELECT 
        'diaper' as recordType, 
        id,
        timestamp, 
        NULL as amount, 
        type, 
        notes
      FROM diapers 
      ORDER BY timestamp DESC 
      LIMIT 100
    `);
    
    return history || [];
  } catch (error) {
    console.error('❌ 获取历史记录失败:', error);
    return [];
  }
};

// 获取上次喂奶时间和间隔
export const getLastFeedingInfo = async () => {
  try {
    if (!db) await initDatabase();
    
    const result = await db.getAllAsync(
      `SELECT timestamp, amount, type 
       FROM feedings 
       ORDER BY timestamp DESC 
       LIMIT 1`
    );
    
    if (result.length > 0) {
      const lastFeeding = result[0];
      const lastTime = new Date(lastFeeding.timestamp);
      const now = new Date();
      const diffMs = now - lastTime;
      
      return {
        exists: true,
        timestamp: lastFeeding.timestamp,
        amount: lastFeeding.amount,
        type: lastFeeding.type,
        timeAgo: diffMs, // 毫秒数
        hours: Math.floor(diffMs / (1000 * 60 * 60)),
        minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      };
    }
    
    return {
      exists: false,
      timeAgo: 0,
      hours: 0,
      minutes: 0
    };
  } catch (error) {
    console.error('❌ 获取上次喂奶信息失败:', error);
    return {
      exists: false,
      timeAgo: 0,
      hours: 0,
      minutes: 0
    };
  }
};

// 删除记录（可选功能）
export const deleteRecord = async (recordType, id) => {
  try {
    if (!db) await initDatabase();
    
    const tableName = recordType === 'feeding' ? 'feedings' : 'diapers';
    await db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    console.log(`✅ 已删除记录: ${tableName} ID: ${id}`);
    return true;
  } catch (error) {
    console.error('❌ 删除记录失败:', error);
    return false;
  }
};

// 清除所有数据（调试用）
export const clearAllData = async () => {
  try {
    if (!db) await initDatabase();
    
    await db.execAsync('DELETE FROM feedings');
    await db.execAsync('DELETE FROM diapers');
    console.log('✅ 所有数据已清除');
    return true;
  } catch (error) {
    console.error('❌ 清除数据失败:', error);
    return false;
  }
};