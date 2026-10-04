import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE = 'https://courses.tncnursing.site';
const EXAM_URL = 'https://test.tncnursing.site';
const COLORS = {
  ink: '#17242A',
  muted: '#738087',
  paper: '#F6F7F3',
  white: '#FFFFFF',
  green: '#1D765D',
  mint: '#DDF0E8',
  coral: '#F1A88D',
  line: '#E5E9E5',
  gold: '#DCA84C',
  red: '#B44646',
};

type Course = { rowId: string; name: string; description?: string; createdAt?: string };
type Subject = { rowId: string; name: string; videoCount?: number; pdfCount?: number; totalCount?: number };
type Lesson = {
  rowId: string;
  title: string;
  contentType?: string;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  firebaseId?: string | null;
  isPaid?: boolean;
  courseId?: string;
  subjectId?: string;
};
type RankRow = { telegramId: string; firstName: string; seconds: number; sessions: number };
type User = { id: string; name: string; platform: string; firstSeen: string; lastSeen: string; isBlocked: boolean; blockedReason?: string | null };
type MobileStats = { installs: number; opensToday: number; opensWeek: number; opensTotal: number; activeToday: number; lessonsCompleted: number };
type Screen = 'home' | 'courses' | 'subjects' | 'lessons' | 'notes' | 'leaderboard' | 'profile' | 'lesson' | 'admin' | 'adminLogin';

const storageKeys = { id: 'tnc.mobile.id', name: 'tnc.mobile.name', progress: 'tnc.mobile.progress', favorites: 'tnc.mobile.favorites', admin: 'tnc.mobile.admin', latestLesson: 'tnc.mobile.latestLesson' };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const installId = await AsyncStorage.getItem(storageKeys.id);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(installId ? { 'x-tnc-install-id': installId } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function newId() {
  return `tnc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function formatTime(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getVideoUri(lesson: Lesson | null): string | null {
  if (!lesson) return null;
  if (lesson.firebaseId) return `${API_BASE}/api/firebase-stream/${encodeURIComponent(lesson.firebaseId)}`;
  if (!lesson.videoUrl) return null;
  return lesson.videoUrl.startsWith('/') ? `${API_BASE}${lesson.videoUrl}` : lesson.videoUrl;
}

function getYouTubeId(uri: string | null): string | null {
  if (!uri) return null;
  try {
    const parsed = new URL(uri);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return videoId;
      const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      return match?.[1] ?? null;
    }
  } catch { return null; }
  return null;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [installId, setInstallId] = useState('');
  const [screen, setScreen] = useState<Screen>('home');
  const [appState, setAppState] = useState(AppState.currentState);
  const [isWatching, setIsWatching] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen>('home');
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notes, setNotes] = useState<Lesson[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankRow[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [courseTab, setCourseTab] = useState<'all' | 'favorites'>('all');
  const [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [stats, setStats] = useState<MobileStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<'overview' | 'users'>('overview');

  useEffect(() => {
    void (async () => {
      const [savedId, savedName, savedProgress, savedFavorites, savedAdmin] = await Promise.all([
        AsyncStorage.getItem(storageKeys.id),
        AsyncStorage.getItem(storageKeys.name),
        AsyncStorage.getItem(storageKeys.progress),
        AsyncStorage.getItem(storageKeys.favorites),
        AsyncStorage.getItem(storageKeys.admin),
      ]);
      const id = savedId ?? newId();
      if (!savedId) await AsyncStorage.setItem(storageKeys.id, id);
      setInstallId(id);
      setName(savedName ?? '');
      setNameInput(savedName ?? '');
      setCompleted(savedProgress ? JSON.parse(savedProgress) as string[] : []);
      setFavorites(savedFavorites ? JSON.parse(savedFavorites) as string[] : []);
      setAdminToken(savedAdmin ?? '');
      if (!savedName) setScreen('profile');
      setReady(true);
    })().catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !installId || appState !== 'active') return;
    void request<{ blocked: boolean; reason?: string }>('/api/mobile/open', {
      method: 'POST', body: JSON.stringify({ installId, platform: Platform.OS, appVersion: '2.0.0' }),
    }).then((result) => {
      if (result.blocked) {
        setBlocked(true);
        setNotice(`Access paused${result.reason ? `: ${result.reason}` : ''}`);
      }
    }).catch(() => setNotice('Connect to the internet to sync your learning.'));
  }, [ready, installId, appState]);

  useEffect(() => {
    if (!ready || appState !== 'active') return;
    let active = true;
    const checkForNewLecture = async () => {
      try {
        const latest = await request<Lesson[]>('/api/sessions?sort=newest&limit=1');
        const newest = latest[0];
        if (!newest || !active) return;
        const previousId = await AsyncStorage.getItem(storageKeys.latestLesson);
        if (previousId && previousId !== newest.rowId) setNotice(`New lecture added: ${newest.title}`);
        await AsyncStorage.setItem(storageKeys.latestLesson, newest.rowId);
      } catch { return; }
    };
    void checkForNewLecture();
    const timer = setInterval(() => void checkForNewLecture(), 15 * 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready, appState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (screen !== 'lesson' || !lesson?.rowId || !isWatching || appState !== 'active' || !installId || !name) return;
    const sessionId = `mobile_${installId}_${lesson.rowId}`;
    const timer = setInterval(() => {
      void request('/api/bot/study/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ visitorId: `mobile:${installId}`, visitorName: name, sessionId, seconds: 30 }),
      }).catch(() => undefined);
    }, 30_000);
    return () => clearInterval(timer);
  }, [screen, lesson?.rowId, isWatching, appState, installId, name]);

  useEffect(() => {
    if (!name || !installId) return;
    void request('/api/mobile/register', {
      method: 'POST', body: JSON.stringify({ installId, name: name.trim(), platform: Platform.OS }),
    }).catch(() => undefined);
  }, [name, installId]);

  useEffect(() => {
    if (screen === 'courses' || screen === 'home') {
      void request<Course[]>('/api/courses').then(setCourses).catch(() => setCourses([]));
    }
    if (screen === 'notes') {
      setLoading(true);
      void request<Lesson[]>('/api/notes?limit=100').then(setNotes).catch(() => setNotes([])).finally(() => setLoading(false));
    }
    if (screen === 'leaderboard') {
      setLoading(true);
      void request<RankRow[]>('/api/bot/study/leaderboard?limit=100').then(setLeaderboard).catch(() => setLeaderboard([])).finally(() => setLoading(false));
    }
    if (screen === 'admin' && adminToken) void loadAdmin();
  }, [screen, adminToken]);

  async function loadAdmin() {
    const headers = { 'x-admin-token': adminToken };
    try {
      const [nextStats, nextUsers] = await Promise.all([
        request<MobileStats>('/api/mobile/admin/stats', { headers }),
        request<{ users: User[] }>('/api/mobile/admin/users?limit=100', { headers }),
      ]);
      setStats(nextStats);
      setUsers(nextUsers.users);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load admin data');
      if (String(error).includes('401')) {
        setAdminToken('');
        await AsyncStorage.removeItem(storageKeys.admin);
        setScreen('adminLogin');
      }
    }
  }

  async function saveName() {
    const value = nameInput.trim().slice(0, 48);
    if (!value) return Alert.alert('Add your name', 'Enter a name to personalize your study space.');
    setName(value);
    await AsyncStorage.setItem(storageKeys.name, value);
    setScreen(value.toLowerCase() === 'admin' ? 'adminLogin' : 'home');
  }

  async function saveProgress(id: string) {
    const next = completed.includes(id) ? completed : [...completed, id];
    setCompleted(next);
    await AsyncStorage.setItem(storageKeys.progress, JSON.stringify(next));
    if (installId && name) {
      void request('/api/mobile/progress', {
        method: 'POST', body: JSON.stringify({ installId, name, sessionId: id, completed: true }),
      }).catch(() => undefined);
    }
  }

  async function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    await AsyncStorage.setItem(storageKeys.favorites, JSON.stringify(next));
  }

  async function openCourse(item: Course) {
    setCourse(item);
    setLoading(true);
    setScreen('subjects');
    try {
      setSubjects(await request<Subject[]>(`/api/subjects?courseId=${encodeURIComponent(item.rowId)}`));
    } catch { setSubjects([]); }
    finally { setLoading(false); }
  }

  async function openSubject(item: Subject) {
    if (!course) return;
    setSubject(item);
    setLoading(true);
    setScreen('lessons');
    try {
      const response = await request<Lesson[]>(`/api/sessions?courseId=${encodeURIComponent(course.rowId)}&subjectId=${encodeURIComponent(item.rowId)}&limit=200`);
      setLessons(response);
    } catch { setLessons([]); }
    finally { setLoading(false); }
  }

  async function openLesson(item: Lesson) {
    setIsWatching(false);
    setLesson(item);
    setPreviousScreen(screen);
    setScreen('lesson');
    if (item.contentType === 'pdf' || item.pdfUrl) {
      const target = item.pdfUrl?.startsWith('http')
        ? item.pdfUrl
        : item.pdfUrl?.startsWith('/')
          ? `${API_BASE}${item.pdfUrl}`
          : `${API_BASE}/api/pdf?path=${encodeURIComponent(item.pdfUrl ?? '')}`;
      await Linking.openURL(target).catch(() => Alert.alert('Unable to open PDF', 'This document could not be opened right now.'));
    } else if (!item.videoUrl && !item.firebaseId) {
      Alert.alert('Lecture unavailable', 'This session does not have a playable video attached yet.');
    }
  }

  async function loginAdmin() {
    try {
      const response = await request<{ token: string }>('/api/admin/login', {
        method: 'POST', body: JSON.stringify({ password: adminPassword }),
      });
      setAdminToken(response.token);
      await AsyncStorage.setItem(storageKeys.admin, response.token);
      setAdminPassword('');
      setScreen('admin');
    } catch { Alert.alert('Access denied', 'That admin password was not accepted.'); }
  }

  async function blockUser(user: User) {
    const blocked = !user.isBlocked;
    try {
      await request(`/api/mobile/admin/users/${encodeURIComponent(user.id)}/${blocked ? 'block' : 'unblock'}`, {
        method: 'POST', headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ reason: blocked ? 'Blocked by admin' : undefined }),
      });
      await loadAdmin();
    } catch { Alert.alert('Could not update access', 'Try again after checking the server connection.'); }
  }

  const visibleCourses = useMemo(() => courses
    .filter((item) => courseTab === 'all' || favorites.includes(item.rowId))
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [courses, query, courseTab, favorites]);
  const visibleNotes = useMemo(() => notes.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())), [notes, query]);

  if (!ready) return <ScreenFrame><ActivityIndicator color={COLORS.green} size="large" /></ScreenFrame>;

  if (blocked) return <ScreenFrame><View style={styles.blockedScreen}><BrandMark /><Text style={styles.adminTitle}>Access paused.</Text><Text style={styles.body}>{notice || 'This app installation cannot access TNC Nursing.'}</Text><Text style={styles.smallNote}>Contact TNC Nursing support if you think this is a mistake.</Text></View></ScreenFrame>;

  if (!name) return (
    <ScreenFrame>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.welcome}>
        <BrandMark />
        <Text style={styles.eyebrow}>TNC NURSING 2.0</Text>
        <Text style={styles.welcomeTitle}>A clearer path{ '\n' }to your next exam.</Text>
        <Text style={styles.body}>Your lessons, notes and study streak, together in one place.</Text>
        <TextInput value={nameInput} onChangeText={setNameInput} placeholder="What should we call you?" placeholderTextColor={COLORS.muted} style={styles.input} returnKeyType="done" onSubmitEditing={() => void saveName()} />
        <PrimaryButton label="Start learning" onPress={() => void saveName()} />
        <Text style={styles.privacyText}>No account needed. Your study name is saved on this device.</Text>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );

  const goBack = () => setScreen(screen === 'lesson' ? previousScreen : screen === 'subjects' ? 'courses' : screen === 'lessons' ? 'subjects' : 'home');
  const pageTitle = ({ home: 'Your study space', courses: 'Video library', subjects: course?.name ?? 'Subjects', lessons: subject?.name ?? 'Lectures', notes: 'E-notes', leaderboard: 'Leaderboard', profile: 'Your profile', lesson: lesson?.title ?? 'Lesson', admin: 'App admin', adminLogin: 'Admin access' } satisfies Record<Screen, string>)[screen];

  return (
    <SafeAreaView style={styles.safe}>
      <NativeStatusBar barStyle="dark-content" backgroundColor={COLORS.paper} />
      <View style={styles.topBar}>
        {screen !== 'home' && <Pressable onPress={goBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>}
        <View style={styles.topBrand}><BrandMark small /><View><Text style={styles.brandName}>TNC NURSING</Text><Text style={styles.topTitle}>{pageTitle}</Text></View></View>
        <Pressable onPress={() => void Share.share({ message: 'Study with TNC Nursing 2.0', url: API_BASE })} style={styles.share}><Text style={styles.shareText}>↗</Text></Pressable>
      </View>
      {notice ? <Pressable onPress={() => setNotice('')} style={styles.notice}><Text style={styles.noticeText}>{notice}  ×</Text></Pressable> : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {screen === 'home' && <>
          <View style={styles.hero}>
            <View style={styles.heroTop}><Text style={styles.heroKicker}>MONDAY MOTIVATION</Text><Text style={styles.heroTag}>STUDY / 02</Text></View>
            <Text style={styles.greeting}>Good to see you,{ '\n' }{name}.</Text>
            <Text style={styles.heroCaption}>One lesson at a time. You’re building something.</Text>
            <View style={styles.heroFoot}><Text style={styles.heroFootText}>{completed.length} lessons completed</Text><Text style={styles.heroFootText}>TNC • NURSING</Text></View>
          </View>
          <View style={styles.actionRow}>
            <QuickLink title="Exams" detail="Practice now" glyph="↗" color={COLORS.coral} onPress={() => void Linking.openURL(EXAM_URL)} />
            <QuickLink title="My courses" detail="Watch lectures" glyph="▶" color={COLORS.mint} onPress={() => setScreen('courses')} />
          </View>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Continue learning</Text><Pressable onPress={() => setScreen('courses')}><Text style={styles.link}>All courses  ›</Text></Pressable></View>
          {courses.slice(0, 3).map((item, index) => <CourseRow key={item.rowId} item={item} index={index} favorite={favorites.includes(item.rowId)} onFavorite={() => void toggleFavorite(item.rowId)} onPress={() => void openCourse(item)} />)}
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Your study toolkit</Text></View>
          <View style={styles.toolRow}>{[['Notes', '▤', 'notes'], ['Rank', '♕', 'leaderboard'], ['Saved', '♡', 'courses'], ['Profile', '◉', 'profile']].map(([label, glyph, target]) => <Pressable key={target} onPress={() => setScreen(target as Screen)} style={styles.tool}><Text style={styles.toolGlyph}>{glyph}</Text><Text style={styles.toolLabel}>{label}</Text></Pressable>)}</View>
        </>}
        {screen === 'courses' && <>
          <Text style={styles.pageIntro}>Choose a batch to find your subject and next lecture.</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search batches and courses" placeholderTextColor={COLORS.muted} style={styles.search} />
          <View style={styles.segment}><Pressable onPress={() => setCourseTab('all')}><Text style={courseTab === 'all' ? styles.segmentActive : styles.segmentOther}>ALL COURSES  ·  {courses.length}</Text></Pressable><Pressable onPress={() => setCourseTab('favorites')}><Text style={courseTab === 'favorites' ? styles.segmentActive : styles.segmentOther}>SAVED ♥</Text></Pressable><Pressable onPress={() => void request<Course[]>('/api/courses').then(setCourses)}><Text style={styles.segmentOther}>↻</Text></Pressable></View>
          {visibleCourses.map((item, index) => <CourseRow key={item.rowId} item={item} index={index} favorite={favorites.includes(item.rowId)} onFavorite={() => void toggleFavorite(item.rowId)} onPress={() => void openCourse(item)} />)}
          {visibleCourses.length === 0 && <EmptyState label={loading ? 'Loading courses…' : 'No courses match that search.'} />}
        </>}
        {screen === 'subjects' && <>
          <Text style={styles.pageIntro}>A focused route through {course?.name ?? 'your course'}.</Text>
          {subjects.map((item, index) => <Pressable key={item.rowId} onPress={() => void openSubject(item)} style={styles.listRow}><Text style={styles.rowNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.totalCount ?? 0} resources  ·  {item.videoCount ?? 0} lectures</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
          {!loading && !subjects.length && <EmptyState label="No subjects available for this course yet." />}
        </>}
        {screen === 'lessons' && <>
          <Text style={styles.pageIntro}>{course?.name} / {subject?.name}</Text>
          {lessons.map((item, index) => <LessonRow key={item.rowId} item={item} index={index} complete={completed.includes(item.rowId)} onPress={() => void openLesson(item)} onComplete={() => void saveProgress(item.rowId)} />)}
          {!loading && !lessons.length && <EmptyState label="No lectures found in this subject." />}
        </>}
        {screen === 'notes' && <>
          <Text style={styles.pageIntro}>Course handouts and revision PDFs, gathered in one shelf.</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search notes" placeholderTextColor={COLORS.muted} style={styles.search} />
          {visibleNotes.map((item, index) => <LessonRow key={item.rowId} item={item} index={index} complete={completed.includes(item.rowId)} onPress={() => void openLesson(item)} onComplete={() => void saveProgress(item.rowId)} />)}
          {!loading && !visibleNotes.length && <EmptyState label="No notes found yet." />}
        </>}
        {screen === 'leaderboard' && <>
          <View style={styles.rankIntro}><Text style={styles.rankTitle}>The study circle</Text><Text style={styles.rankSub}>Consistency, counted in focused time.</Text></View>
          {leaderboard.map((row, index) => <View key={row.telegramId} style={[styles.rankRow, index === 0 && styles.rankFirst]}><Text style={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.rankAvatar}><Text style={styles.rankInitial}>{row.firstName?.slice(0, 1).toUpperCase() || 'S'}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.firstName || 'Student'}{row.firstName === name ? '  YOU' : ''}</Text><Text style={styles.rowMeta}>{row.sessions} study sessions</Text></View><Text style={styles.rankTime}>{formatTime(row.seconds)}</Text></View>)}
          {!loading && !leaderboard.length && <EmptyState label="No study time recorded yet. Complete a lesson to get started." />}
          <Pressable style={styles.outlineButton} onPress={() => setScreen('courses')}><Text style={styles.outlineText}>Start a lecture  →</Text></Pressable>
        </>}
        {screen === 'profile' && <>
          <View style={styles.profileHeader}><BrandMark /><Text style={styles.profileName}>{name}</Text><Text style={styles.profileCaption}>Your device, your study rhythm.</Text></View>
          <View style={styles.profileStatRow}><ProfileStat label="COMPLETED" value={String(completed.length)} /><ProfileStat label="SAVED COURSES" value={String(favorites.length)} /><ProfileStat label="ON LEADERBOARD" value="LIVE" /></View>
          <Pressable style={styles.listRow} onPress={() => setScreen('leaderboard')}><Text style={styles.rowNumber}>01</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>Study leaderboard</Text><Text style={styles.rowMeta}>See the community rankings</Text></View><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable style={styles.listRow} onPress={() => void Share.share({ message: 'Let’s study together with TNC Nursing 2.0', url: API_BASE })}><Text style={styles.rowNumber}>02</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>Share TNC Nursing</Text><Text style={styles.rowMeta}>Invite a classmate</Text></View><Text style={styles.chevron}>↗</Text></Pressable>
          <Pressable style={styles.listRow} onPress={() => { setNameInput(name); setName(''); }}><Text style={styles.rowNumber}>03</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>Change your name</Text><Text style={styles.rowMeta}>Edit your study profile</Text></View><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable style={styles.adminLink} onPress={() => setScreen('adminLogin')}><Text style={styles.adminLinkText}>ADMINISTRATION  →</Text></Pressable>
        </>}
        {screen === 'lesson' && <>
          <View style={styles.lessonPanel}><Text style={styles.eyebrow}>YOUR LECTURE</Text><Text style={styles.lessonTitle}>{lesson?.title}</Text><Text style={styles.body}>{course?.name}{subject ? `  /  ${subject.name}` : ''}</Text></View>
          {lesson?.pdfUrl || lesson?.contentType === 'pdf'
            ? <Pressable style={styles.primaryButton} onPress={() => lesson && void openLesson(lesson)}><Text style={styles.primaryText}>Open PDF  ↗</Text></Pressable>
            : <LecturePlayer uri={getVideoUri(lesson)} onPlayingChange={setIsWatching} />}
          <Pressable style={styles.outlineButton} onPress={() => lesson && void saveProgress(lesson.rowId)}><Text style={styles.outlineText}>{completed.includes(lesson?.rowId ?? '') ? '✓  Completed' : 'Mark as completed'}</Text></Pressable>
          <Text style={styles.smallNote}>Your progress saves on this device and syncs to your study profile when online.</Text>
        </>}
        {screen === 'adminLogin' && <>
          <View style={styles.adminHeader}><Text style={styles.adminBadge}>TNC / ADMIN</Text><Text style={styles.adminTitle}>Private access.</Text><Text style={styles.body}>Sign in with the server-configured admin password.</Text></View>
          <TextInput value={adminPassword} onChangeText={setAdminPassword} placeholder="Admin password" secureTextEntry placeholderTextColor={COLORS.muted} style={styles.input} onSubmitEditing={() => void loginAdmin()} />
          <PrimaryButton label="Unlock dashboard" onPress={() => void loginAdmin()} />
        </>}
        {screen === 'admin' && <>
          <View style={styles.adminControls}><Pressable onPress={() => setTab('overview')}><Text style={tab === 'overview' ? styles.segmentActive : styles.segmentOther}>OVERVIEW</Text></Pressable><Pressable onPress={() => setTab('users')}><Text style={tab === 'users' ? styles.segmentActive : styles.segmentOther}>USERS · {users.length}</Text></Pressable><Pressable onPress={() => void loadAdmin()}><Text style={styles.segmentOther}>↻</Text></Pressable><Pressable onPress={() => { setAdminToken(''); void AsyncStorage.removeItem(storageKeys.admin); setScreen('profile'); }}><Text style={styles.segmentOther}>SIGN OUT</Text></Pressable></View>
          {tab === 'overview' && <>
            <Text style={styles.pageIntro}>App activity from the mobile analytics service.</Text>
            <View style={styles.statsGrid}>{[
              ['Installs', stats?.installs ?? '—'], ['Opens today', stats?.opensToday ?? '—'], ['Opens this week', stats?.opensWeek ?? '—'], ['All opens', stats?.opensTotal ?? '—'], ['Active today', stats?.activeToday ?? '—'], ['Lessons done', stats?.lessonsCompleted ?? '—'],
            ].map(([label, value]) => <View key={label} style={styles.statTile}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
            <Text style={styles.smallNote}>Download totals require Play Store / App Store reporting integration. Installs are unique app installs that have opened the app.</Text>
          </>}
          {tab === 'users' && users.map((user) => <View key={user.id} style={styles.userRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{user.name || 'Student'} {user.isBlocked ? '· BLOCKED' : ''}</Text><Text style={styles.rowMeta}>{user.platform} · last active {new Date(user.lastSeen).toLocaleDateString()}</Text><Text style={styles.userId}>Install {user.id.slice(0, 14)}…</Text></View><Pressable onPress={() => void blockUser(user)} style={[styles.blockButton, user.isBlocked && styles.unblockButton]}><Text style={styles.blockText}>{user.isBlocked ? 'Unblock' : 'Block'}</Text></Pressable></View>)}
          {tab === 'users' && !users.length && <EmptyState label="No mobile users have opened the app yet." />}
        </>}
      </ScrollView>
      {screen !== 'admin' && screen !== 'adminLogin' && screen !== 'lesson' && <View style={styles.bottomNav}>{[
        ['home', '⌂', 'Home'], ['courses', '▣', 'Learn'], ['notes', '▤', 'Notes'], ['leaderboard', '♕', 'Rank'], ['profile', '◉', 'You'],
      ].map(([target, glyph, label]) => <Pressable key={target} onPress={() => { setQuery(''); setScreen(target as Screen); }} style={styles.navItem}><Text style={[styles.navGlyph, screen === target && styles.navSelected]}>{glyph}</Text><Text style={[styles.navLabel, screen === target && styles.navSelected]}>{label}</Text></Pressable>)}</View>}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function ScreenFrame({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.safe}><NativeStatusBar barStyle="dark-content" backgroundColor={COLORS.paper} />{children}</SafeAreaView>;
}

function LecturePlayer({ uri, onPlayingChange }: { uri: string | null; onPlayingChange: (playing: boolean) => void }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  useEffect(() => {
    const subscription = player.addListener('playingChange', ({ isPlaying }) => onPlayingChange(isPlaying));
    return () => subscription.remove();
  }, [player, onPlayingChange]);
  if (!uri) return <EmptyState label="This lecture does not have a playable video attached yet." />;
  const youtubeId = getYouTubeId(uri);
  if (youtubeId) {
    return <WebView
      source={{ html: youtubePlayerHtml(youtubeId), baseUrl: 'https://www.youtube-nocookie.com' }}
      style={styles.video}
      originWhitelist={['*']}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      onMessage={(event) => onPlayingChange(event.nativeEvent.data === 'playing')}
    />;
  }
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />;
}

function youtubePlayerHtml(videoId: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000"><div id="player"></div><script>var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);var player;function onYouTubeIframeAPIReady(){player=new YT.Player('player',{width:'100%',height:'100%',videoId:'${videoId.replace(/[^a-zA-Z0-9_-]/g, '')}',playerVars:{playsinline:1,rel:0},events:{onStateChange:function(e){window.ReactNativeWebView.postMessage(e.data===1?'playing':'paused')}}})}</script></body></html>`;
}

function BrandMark({ small = false }: { small?: boolean }) {
  return <View style={[styles.brandMark, small && styles.brandMarkSmall]}><Text style={[styles.brandMonogram, small && styles.brandMonogramSmall]}>T</Text><View style={styles.brandSlash} /></View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryText}>{label}  →</Text></Pressable>;
}

function QuickLink({ title, detail, glyph, color, onPress }: { title: string; detail: string; glyph: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.quickLink, { backgroundColor: color }]}><Text style={styles.quickGlyph}>{glyph}</Text><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></Pressable>;
}

function CourseRow({ item, index, favorite, onFavorite, onPress }: { item: Course; index: number; favorite: boolean; onFavorite: () => void; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.courseRow}><View style={[styles.courseArt, { backgroundColor: index % 2 ? '#E5ECE7' : '#F3E5D8' }]}><Text style={styles.courseArtGlyph}>{index % 2 ? '✳' : '✦'}</Text></View><View style={styles.rowCopy}><Text style={styles.courseLabel}>BATCH  /  {String(index + 1).padStart(2, '0')}</Text><Text style={styles.rowTitle} numberOfLines={2}>{item.name}</Text><Text style={styles.rowMeta} numberOfLines={1}>{item.description || 'Lectures, subjects and revision notes'}</Text></View><Pressable onPress={(event) => { event.stopPropagation(); onFavorite(); }} hitSlop={10} style={styles.favorite}><Text style={favorite ? styles.favoriteOn : styles.favoriteOff}>{favorite ? '♥' : '♡'}</Text></Pressable></Pressable>;
}

function LessonRow({ item, index, complete, onPress, onComplete }: { item: Lesson; index: number; complete: boolean; onPress: () => void; onComplete: () => void }) {
  const isPdf = item.contentType === 'pdf' || Boolean(item.pdfUrl);
  return <View style={styles.listRow}><Pressable onPress={onPress} style={styles.lessonRowMain}><Text style={styles.rowNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.rowCopy}><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.rowMeta}>{isPdf ? 'PDF  ·  E-NOTE' : 'VIDEO  ·  LECTURE'}</Text></View><Text style={styles.chevron}>{isPdf ? '▤' : '▶'}</Text></Pressable><Pressable onPress={onComplete} style={styles.checkButton}><Text style={complete ? styles.checkDone : styles.check}>{complete ? '✓' : '○'}</Text></Pressable></View>;
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.profileStat}><Text style={styles.profileStatValue}>{value}</Text><Text style={styles.profileStatLabel}>{label}</Text></View>;
}

function EmptyState({ label }: { label: string }) {
  return <View style={styles.empty}><Text style={styles.emptyGlyph}>✳</Text><Text style={styles.emptyText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  topBar: { height: 66, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.line },
  topBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 56, height: 56, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandMarkSmall: { width: 36, height: 36 },
  brandMonogram: { fontSize: 35, color: COLORS.white, fontWeight: '900', lineHeight: 42 },
  brandMonogramSmall: { fontSize: 23, lineHeight: 29 },
  brandSlash: { width: 34, height: 2, backgroundColor: COLORS.coral, position: 'absolute', transform: [{ rotate: '-55deg' }], right: -5, bottom: 12 },
  brandName: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  topTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '700', marginTop: 2 },
  back: { width: 32, marginRight: 8 },
  backText: { fontSize: 34, color: COLORS.green, lineHeight: 38 },
  share: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: COLORS.green, fontSize: 22, fontWeight: '700' },
  notice: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#FFF0E8', padding: 10 },
  noticeText: { color: COLORS.red, fontSize: 12, fontWeight: '600' },
  hero: { backgroundColor: COLORS.green, minHeight: 260, padding: 22, justifyContent: 'space-between', marginBottom: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  heroKicker: { color: '#B8D8CB', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  heroTag: { color: COLORS.coral, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  greeting: { color: COLORS.white, fontSize: 31, lineHeight: 37, fontWeight: '800' },
  heroCaption: { color: '#D5E7E0', fontSize: 13, marginTop: -16 },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#ffffff40', paddingTop: 12 },
  heroFootText: { color: '#D5E7E0', fontSize: 10, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 26 },
  quickLink: { flex: 1, minHeight: 112, padding: 14, justifyContent: 'flex-end' },
  quickGlyph: { position: 'absolute', right: 13, top: 10, fontSize: 22, color: COLORS.ink },
  quickTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '800' },
  quickDetail: { color: COLORS.ink, fontSize: 11, opacity: 0.7, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '800' },
  link: { color: COLORS.green, fontSize: 12, fontWeight: '700' },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.line },
  courseArt: { width: 64, height: 70, alignItems: 'center', justifyContent: 'center' },
  courseArtGlyph: { fontSize: 28, color: COLORS.green },
  rowCopy: { flex: 1 },
  courseLabel: { fontSize: 8, color: COLORS.green, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 },
  rowTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  favorite: { width: 28, alignItems: 'center' },
  favoriteOn: { fontSize: 19, color: COLORS.red },
  favoriteOff: { fontSize: 22, color: COLORS.muted },
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  tool: { width: '23%', height: 76, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line },
  toolGlyph: { fontSize: 23, color: COLORS.green },
  toolLabel: { color: COLORS.ink, fontSize: 10, marginTop: 4, fontWeight: '600' },
  pageIntro: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginBottom: 18 },
  search: { height: 48, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 14, color: COLORS.ink, marginBottom: 14 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.line, marginBottom: 8 },
  segmentActive: { color: COLORS.green, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  segmentOther: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  listRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.line },
  rowNumber: { width: 38, color: COLORS.gold, fontSize: 11, fontWeight: '800' },
  chevron: { color: COLORS.green, fontSize: 20, marginLeft: 12 },
  lessonRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkButton: { width: 36, alignItems: 'center' },
  check: { fontSize: 20, color: COLORS.muted },
  checkDone: { fontSize: 18, color: COLORS.green },
  empty: { paddingVertical: 55, alignItems: 'center' },
  emptyGlyph: { color: COLORS.coral, fontSize: 30, marginBottom: 10 },
  emptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  rankIntro: { backgroundColor: COLORS.green, padding: 20, marginBottom: 12 },
  rankTitle: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  rankSub: { color: '#CDE2D9', fontSize: 12, marginTop: 5 },
  rankRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderColor: COLORS.line },
  rankFirst: { backgroundColor: '#F1F4EC' },
  rankNumber: { color: COLORS.gold, fontWeight: '900', fontSize: 12, width: 24 },
  rankAvatar: { width: 34, height: 34, backgroundColor: COLORS.mint, alignItems: 'center', justifyContent: 'center' },
  rankInitial: { color: COLORS.green, fontWeight: '800' },
  rankTime: { color: COLORS.green, fontWeight: '800', fontSize: 12 },
  outlineButton: { minHeight: 48, borderWidth: 1, borderColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 16 },
  outlineText: { color: COLORS.green, fontSize: 13, fontWeight: '800' },
  profileHeader: { alignItems: 'center', paddingVertical: 30 },
  blockedScreen: { flex: 1, backgroundColor: COLORS.paper, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  profileName: { color: COLORS.ink, fontSize: 24, fontWeight: '800', marginTop: 12 },
  profileCaption: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  profileStatRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 16, marginBottom: 18 },
  profileStat: { flex: 1, alignItems: 'center' },
  profileStatValue: { color: COLORS.green, fontSize: 17, fontWeight: '900' },
  profileStatLabel: { color: COLORS.muted, fontSize: 7, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  adminLink: { marginTop: 30, paddingVertical: 18, borderTopWidth: 1, borderColor: COLORS.line },
  adminLinkText: { color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  lessonPanel: { backgroundColor: COLORS.mint, padding: 22, minHeight: 190, justifyContent: 'center', marginBottom: 18 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#111111', marginBottom: 18 },
  lessonTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 24, lineHeight: 30, marginVertical: 12 },
  smallNote: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
  adminHeader: { marginVertical: 28 },
  adminBadge: { color: COLORS.green, fontWeight: '900', letterSpacing: 1, fontSize: 10 },
  adminTitle: { color: COLORS.ink, fontSize: 27, fontWeight: '800', marginVertical: 10 },
  input: { height: 54, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, color: COLORS.ink, paddingHorizontal: 15, marginBottom: 12 },
  welcome: { flex: 1, justifyContent: 'center', paddingHorizontal: 26 },
  eyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginTop: 22 },
  welcomeTitle: { color: COLORS.ink, fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 14 },
  body: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 9, marginBottom: 22 },
  privacyText: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 15 },
  primaryButton: { backgroundColor: COLORS.green, minHeight: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, marginTop: 8 },
  primaryText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  adminControls: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.line, marginBottom: 18 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: { width: '48%', minHeight: 90, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, padding: 14 },
  statValue: { color: COLORS.green, fontSize: 23, fontWeight: '900' },
  statLabel: { color: COLORS.muted, fontSize: 11, marginTop: 5 },
  userRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.line, paddingVertical: 12, gap: 8 },
  userId: { color: COLORS.muted, fontSize: 8, marginTop: 3 },
  blockButton: { backgroundColor: '#F9E8E5', paddingHorizontal: 11, paddingVertical: 8 },
  unblockButton: { backgroundColor: COLORS.mint },
  blockText: { color: COLORS.red, fontSize: 10, fontWeight: '800' },
  bottomNav: { minHeight: 62, backgroundColor: COLORS.white, borderTopWidth: 1, borderColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 0 : 4 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navGlyph: { color: COLORS.muted, fontSize: 19, fontWeight: '700' },
  navLabel: { color: COLORS.muted, fontSize: 8, marginTop: 2, fontWeight: '600' },
  navSelected: { color: COLORS.green },
});
