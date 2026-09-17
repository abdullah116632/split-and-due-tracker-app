import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Card, Divider } from '@/components/ui/card';
import { ListRow, RowIcon } from '@/components/ui/list-row';
import { PageTitle, Screen, SectionHeader } from '@/components/ui/screen';
import { exportBackup, parseBackup, restoreBackup } from '@/db/backup';
import { todayISO } from '@/lib/date';
import { useMe, useRequiredMe } from '@/lib/me-context';

export default function Settings() {
  const db = useSQLiteContext();
  const me = useRequiredMe();
  const { refreshMe } = useMe();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup(db);
      const file = new File(Paths.cache, `split-and-due-backup-${todayISO()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(backup));
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your backup',
        UTI: 'public.json',
      });
    } catch (e) {
      Alert.alert('Backup failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const text = await new File(picked.assets[0].uri).text();
      const backup = await parseBackup(db, text);
      const when = new Date(backup.exportedAt).toLocaleString();
      Alert.alert(
        'Restore this backup?',
        `Backup from ${when}.\n\nThis will REPLACE all data currently in the app. This can't be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await restoreBackup(db, backup);
                await refreshMe();
                Alert.alert('Restored', 'Your data has been restored.');
              } catch (e) {
                Alert.alert('Restore failed', (e as Error).message);
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Restore failed', (e as Error).message);
    }
  };

  return (
    <Screen edges={['top']}>
      <PageTitle title="Settings" />

      <SectionHeader title="Profile" />
      <Card>
        <ListRow
          left={<Avatar name={me.name} />}
          title={me.name}
          subtitle={[me.phone, me.email].filter(Boolean).join(' · ') || 'Tap to add phone or email'}
          onPress={() => router.push(`/person/new?id=${me.id}`)}
          chevron
        />
      </Card>

      <SectionHeader title="Backup" />
      <Card>
        <ListRow
          left={<RowIcon name="cloud-upload-outline" tone="teal" />}
          title="Export backup"
          subtitle="Save a file to Drive, email or your phone"
          onPress={busy ? undefined : handleExport}
          chevron
        />
        <Divider />
        <ListRow
          left={<RowIcon name="cloud-download-outline" tone="blue" />}
          title="Restore from backup"
          subtitle="Replace all data with a backup file"
          onPress={busy ? undefined : handleImport}
          chevron
        />
      </Card>
      <Text className="px-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
        Everything is stored only on this phone. If you uninstall the app or lose your phone, your
        data is gone — export a backup regularly.
      </Text>

      <View className="items-center pt-6">
        <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Split & Due</Text>
        <Text className="text-xs text-slate-400">Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </Screen>
  );
}
