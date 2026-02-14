import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-pt-dark border-t border-pt-yellow/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <Link to="/" className="font-heading text-2xl text-pt-yellow tracking-wider hover:text-pt-yellow/90 transition">
              PlotTwist
            </Link>
            <p className="mt-1 text-sm text-pt-gray">
              {t('footer.tagline')}
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Social links placeholder */}
            <a href="#" className="text-pt-gray hover:text-pt-yellow transition text-sm" aria-label={t('footer.twitter')}>
              {t('footer.twitter')}
            </a>
            <a href="#" className="text-pt-gray hover:text-pt-yellow transition text-sm" aria-label={t('footer.discord')}>
              {t('footer.discord')}
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-pt-yellow/10 text-center text-sm text-pt-gray">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
