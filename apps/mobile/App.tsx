import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// O app exige login antes do cardápio (RQ-26). As telas entram na Fase 6.
export default function App() {
  return (
    <View style={styles.container}>
      <Text>Bastião · App em construção (Fase 1 · Fundação).</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
