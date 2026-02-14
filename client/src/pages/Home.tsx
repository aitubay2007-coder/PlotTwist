import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Swords, Zap, ChevronRight } from 'lucide-react';
import Footer from '../components/Footer';

export default function Home() {
  const { t } = useTranslation();

  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      titleKey: 'hero.feature_predict_title',
      descKey: 'hero.feature_predict_desc',
    },
    {
      icon: <Users className="w-8 h-8" />,
      titleKey: 'hero.feature_clan_title',
      descKey: 'hero.feature_clan_desc',
    },
    {
      icon: <Swords className="w-8 h-8" />,
      titleKey: 'hero.feature_challenge_title',
      descKey: 'hero.feature_challenge_desc',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      titleKey: 'hero.feature_reputation_title',
      descKey: 'hero.feature_reputation_desc',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Halftone background pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle, #FFD60A 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pt-black/50 to-pt-black" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-heading text-7xl sm:text-8xl md:text-9xl text-pt-yellow tracking-wider leading-none mb-2">
              PlotTwist
            </h1>
            <p className="font-heading text-2xl sm:text-3xl md:text-4xl text-pt-white tracking-wide mb-6">
              {t('hero.title')}
            </p>
            <p className="text-pt-gray-light text-lg sm:text-xl max-w-2xl mx-auto mb-10">
              {t('hero.subtitle')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/register"
              className="bg-pt-yellow text-pt-black font-bold text-lg px-8 py-4 rounded-lg hover:bg-pt-yellow-dark transition-colors inline-flex items-center justify-center gap-2"
            >
              {t('hero.cta')}
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              to="/dashboard"
              className="border-2 border-pt-yellow text-pt-yellow font-bold text-lg px-8 py-4 rounded-lg hover:bg-pt-yellow/10 transition-colors"
            >
              {t('hero.secondary')}
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
            {[
              { value: '1000+', label: t('hero.stats_predictions') },
              { value: '50K+', label: t('hero.stats_users') },
              { value: '10M+', label: t('common.coins') },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-3xl text-pt-yellow">{stat.value}</div>
                <div className="text-pt-gray text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="font-heading text-5xl text-center text-pt-yellow mb-16">
          {t('hero.how_it_works')}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-pt-card border border-pt-yellow/20 rounded-xl p-6 hover:border-pt-yellow/50 transition-colors"
            >
              <div className="text-pt-yellow mb-4">{f.icon}</div>
              <h3 className="text-pt-white font-bold text-xl mb-2">
                {t(f.titleKey)}
              </h3>
              <p className="text-pt-gray">
                {t(f.descKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 max-w-6xl mx-auto px-6 text-center">
        <div className="mx-auto bg-gradient-to-r from-pt-yellow/10 via-pt-yellow/5 to-pt-yellow/10 border border-pt-yellow/30 rounded-2xl p-12">
          <h2 className="font-heading text-4xl text-pt-yellow mb-4">{t('hero.ready_to_play')}</h2>
          <p className="text-pt-gray-light text-lg mb-8">
            {t('hero.ready_description')}
          </p>
          <Link
            to="/register"
            className="bg-pt-yellow text-pt-black font-bold text-lg px-10 py-4 rounded-lg hover:bg-pt-yellow-dark transition-colors inline-flex items-center gap-2"
          >
            {t('hero.cta')}
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
