// App.js - 完整版本（适配新版数据库API，包含喂奶间隔提醒）
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  FlatList,
  RefreshControl,
  TextInput 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 导入数据库函数
import { 
  initDatabase, 
  addFeeding, 
  addDiaper, 
  getTodayStats, 
  getAllHistory,
  getLastFeedingInfo
} from './database';

// ========== 主页组件 ==========
function HomeScreen({ navigation }) {
  const [stats, setStats] = useState({ 
    today: { feedings: 0, totalMilk: 0, pee: 0, poop: 0 },
    recentFeedings: [],
    recentDiapers: []
  });
  const [lastFeedingInfo, setLastFeedingInfo] = useState({
    exists: false,
    hours: 0,
    minutes: 0,
    amount: 0,
    type: '',
    timestamp: ''
  });
  const [refreshing, setRefreshing] = useState(false);
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(0);

  // 加载数据
  const loadData = async () => {
    try {
      console.log('开始加载数据...');
      const [statsData, lastFeedingData] = await Promise.all([
        getTodayStats(),
        getLastFeedingInfo()
      ]);
      
      console.log('数据加载成功');
      setStats(statsData);
      setLastFeedingInfo(lastFeedingData);
      setTimeSinceLastUpdate(0); // 重置计时器
    } catch (error) {
      console.error('加载数据失败:', error);
      Alert.alert('提示', '加载数据失败，请稍后重试');
    }
  };

  // 页面加载时初始化并读取数据
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDatabase();
        console.log('数据库初始化完成');
        await loadData();
      } catch (error) {
        console.error('应用初始化失败:', error);
        Alert.alert('初始化错误', '应用初始化失败，请重启应用');
      }
    };
    
    initializeApp();
    
    // 添加监听器，当从记录页面返回时刷新数据
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    
    return unsubscribe;
  }, [navigation]);

  // 实时更新时间间隔（每分钟更新一次）
  useEffect(() => {
    if (!lastFeedingInfo.exists) return;
    
    const interval = setInterval(() => {
      setTimeSinceLastUpdate(prev => prev + 1);
    }, 60000); // 每分钟更新一次
    
    return () => clearInterval(interval);
  }, [lastFeedingInfo.exists]);

  // 计算当前时间间隔
  const calculateCurrentTimeAgo = () => {
    if (!lastFeedingInfo.exists || !lastFeedingInfo.timestamp) {
      return { hours: 0, minutes: 0 };
    }
    
    const lastTime = new Date(lastFeedingInfo.timestamp);
    const now = new Date();
    const diffMs = now - lastTime;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };

  // 获取时间间隔文本和颜色
  const getTimeAgoDisplay = () => {
    const { hours, minutes } = calculateCurrentTimeAgo();
    
    let displayText = '';
    let color = '#4CAF50'; // 默认绿色
    
    if (hours === 0 && minutes === 0) {
      displayText = '刚刚喂过';
    } else if (hours === 0) {
      displayText = `${minutes}分钟前`;
      if (minutes >= 45) color = '#FF9800'; // 橙色警告
    } else {
      displayText = `${hours}小时${minutes}分钟前`;
      
      // 根据时间间隔改变颜色
      if (hours >= 3 && hours < 4) {
        color = '#FF9800'; // 橙色：可能需要喂奶了
      } else if (hours >= 4) {
        color = '#F44336'; // 红色：应该喂奶了
      }
    }
    
    return { text: displayText, color };
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false // 使用24小时制
      });
    } catch (e) {
      console.error('时间格式化错误:', e);
      return '--:--';
    }
  };

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 今日统计卡片 */}
      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>今日统计</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.today.feedings}</Text>
            <Text style={styles.statLabel}>喂养次数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.today.totalMilk}</Text>
            <Text style={styles.statLabel}>总奶量(ml)</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.today.pee}</Text>
            <Text style={styles.statLabel}>小便</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.today.poop}</Text>
            <Text style={styles.statLabel}>大便</Text>
          </View>
        </View>
      </View>

      {/* ========== 新增：上次喂奶时间间隔卡片 ========== */}
      <View style={styles.timeAgoCard}>
        <Text style={styles.cardTitle}>喂奶间隔提醒</Text>
        
        {lastFeedingInfo.exists ? (
          <>
            <View style={styles.timeAgoContent}>
              <Text style={[styles.timeAgoText, { color: getTimeAgoDisplay().color }]}>
                {getTimeAgoDisplay().text}
              </Text>
              
              <View style={styles.lastFeedingDetails}>
                <Text style={styles.detailText}>
                  上次：{formatTime(lastFeedingInfo.timestamp)}
                </Text>
                <Text style={styles.detailText}>
                  {lastFeedingInfo.amount}ml · {lastFeedingInfo.type}
                </Text>
              </View>
              
              {/* 提醒建议 */}
              {calculateCurrentTimeAgo().hours >= 4 && (
                <View style={styles.reminderBox}>
                  <Text style={styles.reminderText}>💡 宝宝可能饿了，建议喂奶</Text>
                </View>
              )}
              {calculateCurrentTimeAgo().hours >= 3 && calculateCurrentTimeAgo().hours < 4 && (
                <View style={styles.reminderBoxWarning}>
                  <Text style={styles.reminderText}>⏰ 距离上次喂奶已超过3小时</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.feedNowButton}
              onPress={() => navigation.navigate('Record', { type: 'feeding' })}
            >
              <Text style={styles.feedNowButtonText}>现在喂奶</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noRecordContainer}>
            <Text style={styles.noRecordText}>暂无喂奶记录</Text>
            <Text style={styles.noRecordHint}>记录第一次喂奶开始计时</Text>
            <TouchableOpacity 
              style={styles.firstRecordButton}
              onPress={() => navigation.navigate('Record', { type: 'feeding' })}
            >
              <Text style={styles.firstRecordButtonText}>记录第一次喂奶</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 快速记录按钮 */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => navigation.navigate('Record', { type: 'feeding' })}
        >
          <Text style={styles.actionText}>记录喂奶</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={() => navigation.navigate('Record', { type: 'diaper' })}
        >
          <Text style={styles.actionText}>记录大小便</Text>
        </TouchableOpacity>
      </View>

      {/* 最近记录 */}
      <View style={styles.recentCard}>
        <Text style={styles.cardTitle}>最近记录</Text>
        
        <Text style={styles.sectionTitle}>喂奶记录</Text>
        {stats.recentFeedings && stats.recentFeedings.length > 0 ? ( 
          stats.recentFeedings.map((item, index) => ( 
            <View key={`feeding-${item.id || index}-${index}`} style={styles.recordItem}> 
              <Text style={styles.recordTime}>{formatTime(item.timestamp)}</Text> 
              <Text style={styles.recordDetails}> 
                {item.amount}ml · {item.type} 
              </Text> 
            </View> 
          )) 
        ) : ( 
          <Text style={styles.emptyText}>暂无喂奶记录</Text> 
        )}

        <Text style={[styles.sectionTitle, { marginTop: 15 }]}>大小便记录</Text>
        {stats.recentDiapers && stats.recentDiapers.length > 0 ? ( 
          stats.recentDiapers.map((item, index) => ( 
            <View key={`diaper-${item.id || index}-${index}`} style={styles.recordItem}> 
              <Text style={styles.recordTime}>{formatTime(item.timestamp)}</Text> 
              <Text style={styles.recordDetails}>{item.type}</Text> 
            </View> 
          )) 
        ) : ( 
          <Text style={styles.emptyText}>暂无大小便记录</Text> 
        )}

        <TouchableOpacity 
          style={styles.historyButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.historyButtonText}>查看完整历史 →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ========== 记录页面 ==========
function RecordScreen({ route, navigation }) {
  const { type } = route.params || { type: 'feeding' };
  const isFeeding = type === 'feeding';

  const [amount, setAmount] = useState('100');
  const [recordType, setRecordType] = useState(isFeeding ? '母乳' : '小便');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    
    // 简单验证
    if (isFeeding && (!amount || isNaN(amount) || parseInt(amount) <= 0)) {
      Alert.alert('输入错误', '请输入有效的奶量');
      return;
    }
    
    setIsSaving(true);
    
    try {
      if (isFeeding) {
        await addFeeding(parseInt(amount), recordType, notes);
        Alert.alert('成功', `已保存喂奶记录：${amount}ml ${recordType}`, [
          { text: '确定', onPress: () => navigation.goBack() }
        ]);
      } else {
        await addDiaper(recordType, notes);
        Alert.alert('成功', `已保存${recordType}记录`, [
          { text: '确定', onPress: () => navigation.goBack() }
        ]);
      }
      
      // 清空表单
      setAmount('100');
      setRecordType(isFeeding ? '母乳' : '小便');
      setNotes('');
      
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert('错误', '保存记录失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {isFeeding ? '记录喂奶' : '记录大小便'}
        </Text>

        {isFeeding ? (
          <>
            <Text style={styles.label}>奶量 (ml)</Text>
            <View style={styles.amountButtons}>
              {[60, 90, 120, 150].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.amountButton,
                    amount === num.toString() && styles.amountButtonActive
                  ]}
                  onPress={() => setAmount(num.toString())}
                >
                  <Text style={[
                    styles.amountButtonText,
                    amount === num.toString() && styles.amountButtonTextActive
                  ]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.customInput}
              placeholder="自定义奶量"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              editable={!isSaving}
            />

            <Text style={styles.label}>类型</Text>
            <View style={styles.typeButtons}>
              {['母乳', '配方奶'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeButton,
                    recordType === t && styles.typeButtonActive
                  ]}
                  onPress={() => setRecordType(t)}
                  disabled={isSaving}
                >
                  <Text style={[
                    styles.typeButtonText,
                    recordType === t && styles.typeButtonTextActive
                  ]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>类型</Text>
            <View style={[styles.typeButtons, { flexDirection: 'column' }]}>
              {['小便', '大便', '两者都有'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeButton,
                    recordType === t && styles.typeButtonActive,
                    { width: '100%', marginBottom: 10 }
                  ]}
                  onPress={() => setRecordType(t)}
                  disabled={isSaving}
                >
                  <Text style={[
                    styles.typeButtonText,
                    recordType === t && styles.typeButtonTextActive
                  ]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>备注（可选）</Text>
        <TextInput
          style={[styles.customInput, { height: 80, textAlignVertical: 'top' }]}
          placeholder="可记录特殊情况、宝宝状态等"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          editable={!isSaving}
        />

        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? '保存中...' : '保存记录'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ========== 历史页面 ==========
function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    try {
      console.log('开始加载历史记录...');
      const data = await getAllHistory();
      console.log('历史记录加载成功，数量:', data.length);
      setRecords(data);
    } catch (error) {
      console.error('加载历史失败:', error);
      Alert.alert('提示', '加载历史记录失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '未知时间';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // 使用24小时制
      }).replace(/\//g, '-');
    } catch (e) {
      console.error('时间格式化错误:', e);
      return '无效时间';
    }
  };

  const renderHistoryItem = ({ item, index }) => {
    const isFeeding = item.recordType === 'feeding';
    
    return (
      <View style={styles.historyItem}>
        <View style={styles.historyItemLeft}>
          <View style={[
            styles.historyIcon,
            { backgroundColor: isFeeding ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.historyIconText}>
              {isFeeding ? '奶' : '便'}
            </Text>
          </View>
          <View style={styles.historyContent}>
            <Text style={styles.historyTime}>{formatDateTime(item.timestamp)}</Text>
            <Text style={styles.historyDetails}>
              {isFeeding ? `${item.amount || 0}ml · ${item.type || '未知'}` : item.type || '未知'}
            </Text>
            {item.notes ? (
              <Text style={styles.historyNotes}>备注：{item.notes}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>历史记录</Text>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList 
          data={records} 
          keyExtractor={(item, index) => { 
            // 确保key唯一：使用记录类型+ID+索引的组合 
            const recordType = item.recordType || 'unknown'; 
            const id = item.id ? item.id.toString() : 'no-id'; 
            return `${recordType}-${id}-${index}`; 
          }} 
          renderItem={renderHistoryItem} 
          refreshControl={ 
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> 
          } 
          ListEmptyComponent={ 
            <View style={styles.emptyContainer}> 
              <Text style={styles.emptyListText}>暂无历史记录</Text> 
              <TouchableOpacity onPress={loadHistory}> 
                <Text style={styles.retryText}>点击重试</Text> 
              </TouchableOpacity> 
            </View> 
          } 
        />
      )}
    </View>
  );
}

// ========== 主程序 ==========
const Stack = createNativeStackNavigator();

export default function App() {
  // 应用启动时初始化数据库
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('应用启动，初始化数据库...');
        await initDatabase();
        console.log('数据库初始化成功');
      } catch (error) {
        console.error('应用初始化失败:', error);
      }
    };
    
    initialize();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ 
            title: '宝宝喂养记录',
            headerBackTitle: '返回'
          }}
        />
        <Stack.Screen 
          name="Record" 
          component={RecordScreen} 
          options={{ 
            title: '添加记录',
            headerBackTitle: '返回'
          }}
        />
        <Stack.Screen 
          name="History" 
          component={HistoryScreen} 
          options={{ 
            title: '历史记录',
            headerBackTitle: '返回'
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ========== 样式 ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // 统计卡片
  statsCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  // 时间间隔卡片样式
  timeAgoCard: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  timeAgoContent: {
    alignItems: 'center',
    marginBottom: 15,
  },
  timeAgoText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  lastFeedingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  reminderBox: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
    width: '100%',
    alignItems: 'center',
  },
  reminderBoxWarning: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
    width: '100%',
    alignItems: 'center',
  },
  reminderText: {
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 14,
  },
  feedNowButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  feedNowButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noRecordContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noRecordText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  noRecordHint: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  firstRecordButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  firstRecordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // 快速操作
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 15,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // 最近记录
  recentCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recordTime: {
    fontSize: 16,
    color: '#333',
  },
  recordDetails: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  historyButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  historyButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  // 记录表单
  formCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  amountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  amountButton: {
    width: '23%',
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 10,
  },
  amountButtonActive: {
    backgroundColor: '#2196F3',
  },
  amountButtonText: {
    fontSize: 18,
    color: '#333',
  },
  amountButtonTextActive: {
    color: 'white',
  },
  customInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  typeButton: {
    width: '48%',
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 10,
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 16,
    color: '#333',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // 历史页面
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 20,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  historyItem: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    flexShrink: 0,
  },
  historyIconText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  historyContent: {
    flex: 1,
  },
  historyTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  historyDetails: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginBottom: 10,
  },
  retryText: {
    color: '#2196F3',
    fontSize: 14,
  },
});