import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '~/lib/session';

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fefbf6',
        }}
      >
        <ActivityIndicator color="#c9a87c" />
      </View>
    );
  }

  return <Redirect href={session ? '/logging' : '/sign-in'} />;
}
