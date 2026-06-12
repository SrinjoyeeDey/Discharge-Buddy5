import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { TranslateText as Text } from '@/components/TranslateText';
import { Feather } from '@expo/vector-icons';
import { customFetch } from '@workspace/api-client-react';

export function PendingFamilyRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const data = await customFetch<{ requests: any[] }>("/api/links/pending");
      setRequests(data.requests || []);
    } catch (e) {
      console.warn("Failed to fetch pending requests", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (managerId: string) => {
    try {
      await customFetch(`/api/links/${managerId}/approve`, {
        method: 'POST',
      });
      Alert.alert("Success", "Family member approved successfully.");
      fetchRequests();
    } catch (e) {
      Alert.alert("Error", "Failed to approve request.");
    }
  };

  const handleReject = async (managerId: string) => {
    try {
      await customFetch(`/api/links/${managerId}/reject`, {
        method: 'POST',
      });
      Alert.alert("Declined", "Connection request declined.");
      fetchRequests();
    } catch (e) {
      Alert.alert("Error", "Failed to decline request.");
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 20 }} />;
  if (requests.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="users" size={18} color="#eab308" />
        <Text style={styles.title}>Pending Family Requests</Text>
      </View>
      <Text style={styles.desc}>These family members want to connect with your profile.</Text>

      {requests.map(req => (
        <View key={req.id} style={styles.card}>
          <View style={styles.info}>
            <Text style={styles.name}>{req.managerName}</Text>
            <Text style={styles.email}>{req.managerEmail}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req.managerId)}>
              <Feather name="x" size={18} color="#ef4444" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(req.managerId)}>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 18,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fefce8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#854d0e',
  },
  desc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#a16207',
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef08a',
    marginTop: 8,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#1e293b',
  },
  email: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rejectBtn: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  approveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#fff',
  }
});
