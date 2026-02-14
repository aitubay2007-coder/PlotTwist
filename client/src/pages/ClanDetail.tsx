import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Copy, Crown, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ClanMemberRow {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
    coins: number;
    reputation: number;
  } | null;
}

interface ClanDetailData {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
  clan_members: ClanMemberRow[];
}

export default function ClanDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [clan, setClan] = useState<ClanDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClan();
  }, [id]);

  const fetchClan = async () => {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('id, name, description, invite_code, created_at, clan_members(user_id, role, joined_at, profiles(username, avatar_url, coins, reputation))')
        .eq('id', id)
        .single();

      if (error || !data) {
        setClan(null);
      } else {
        setClan(data as unknown as ClanDetailData);
      }
    } catch {
      setClan(null);
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = () => {
    if (clan?.invite_code) {
      navigator.clipboard.writeText(clan.invite_code);
      toast.success(t('clans.copy_link'));
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ height: 32, background: '#1C2538', borderRadius: 8, width: '33%' }} />
          <div style={{ height: 200, background: '#1C2538', borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!clan) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('clans.not_found')}</p>
        <Link to="/clans" style={{ color: '#FFD60A', marginTop: 16, display: 'inline-block' }}>{t('common.back')}</Link>
      </div>
    );
  }

  const sortedMembers = [...(clan.clan_members || [])].sort(
    (a, b) => (b.profiles?.reputation || 0) - (a.profiles?.reputation || 0)
  );

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/clans" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#64748B', textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Clan Header */}
        <div style={{ background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)', borderRadius: 16, padding: 32, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 40, color: '#FFD60A', margin: '0 0 8px' }}>{clan.name}</h1>
              {clan.description && <p style={{ color: '#64748B', marginTop: 8 }}>{clan.description}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, color: '#64748B', fontSize: 14 }}>
                <Users size={16} />
                {sortedMembers.length} {t('clans.members')}
              </div>
            </div>
            <button
              onClick={copyInvite}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.3)',
                color: '#FFD60A', cursor: 'pointer',
              }}
            >
              <Copy size={16} />
              {t('clans.copy_link')}
            </button>
          </div>
        </div>

        {/* Clan Leaderboard */}
        <div style={{ background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)', borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: '#FFD60A', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={24} />
            {t('leaderboard.title')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedMembers.map((member, i) => (
              <div
                key={member.user_id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#0B1120', borderRadius: 12, padding: 16,
                  border: i === 0 ? '1px solid rgba(255,214,10,0.4)' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{
                    fontFamily: "'Bangers', cursive", fontSize: 22, width: 32, textAlign: 'center',
                    color: i === 0 ? '#FFD60A' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#64748B',
                  }}>
                    {i + 1}
                  </span>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,214,10,0.15)', color: '#FFD60A', fontWeight: 700, fontSize: 14,
                  }}>
                    {member.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <span style={{ color: '#E2E8F0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      @{member.profiles?.username || 'unknown'}
                      {member.role === 'admin' && <Crown size={12} color="#FFD60A" />}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#FFD60A', fontWeight: 700 }}>{(member.profiles?.reputation || 0).toLocaleString()}</div>
                  <div style={{ color: '#64748B', fontSize: 12 }}>{t('leaderboard.reputation')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
