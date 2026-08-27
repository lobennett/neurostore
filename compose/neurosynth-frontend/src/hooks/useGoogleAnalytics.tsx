import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
    interface Window {
        gtag?: (
            type: 'event' | 'config' | 'get' | 'set' | 'consent',
            action: 'login' | 'page_view',
            options?: any
        ) => void;
    }
}

export const routeMapping = (path: string) => {
    const pathname = path.split(/[?#]/, 1)[0];
    if (/^\/projects\/.*\/curation\/search.*$/g.test(pathname)) {
        return 'curation search page';
    } else if (/^\/projects\/.*\/curation$/g.test(pathname)) {
        return 'curation page';
    } else if (/^\/projects\/.*\/project$/g.test(pathname)) {
        return 'project page';
    } else if (/^\/projects$/g.test(pathname)) {
        return 'projects page';
    } else if (/^\/projects\/.*\/meta-analyses\/.*/g.test(pathname)) {
        return 'project meta-analysis page';
    } else if (/^\/projects\/.*\/meta-analyses$/g.test(pathname)) {
        return 'project meta-analyses page';
    } else if (/^\/projects\/new\/sleuth$/g.test(pathname)) {
        return 'sleuth import page';
    } else if (/^\/base-studies$/g.test(pathname)) {
        return 'base-studies page';
    } else if (/^\/base-studies\/.*$/g.test(pathname)) {
        return 'base-study page';
    } else if (/^\/meta-analyses\/.*$/g.test(pathname)) {
        return 'meta-analysis page';
    } else if (/^\/meta-analyses$/g.test(pathname)) {
        return 'meta-analyses page';
    } else if (/^\/decode$/g.test(pathname)) {
        return 'decode page';
    } else if (/^\/projects\/.*\/extraction\/studies\/.*\/edit$/g.test(pathname)) {
        return 'edit project study page';
    } else if (/^\/projects\/.*\/extraction\/studies\/.*$/g.test(pathname)) {
        return 'project study page';
    } else if (/^\/projects\/.*\/extraction\/annotations$/g.test(pathname)) {
        return 'annotations page';
    } else if (/^\/projects\/.*\/extraction$/g.test(pathname)) {
        return 'extraction page';
    } else if (/^\/user-profile$/g.test(pathname)) {
        return 'user profile page';
    } else if (/^\/forbidden$/g.test(pathname)) {
        return 'forbidden page';
    } else if (/^\/termsandconditions$/g.test(pathname)) {
        return 'terms and conditions page';
    } else {
        return 'not found page';
    }
};

const useGoogleAnalytics = () => {
    const location = useLocation();

    useEffect(() => {
        if (window.gtag) {
            window.gtag('event', 'page_view', {
                page_path: routeMapping(location.pathname),
            });
        }
    }, [location]);
};

export default useGoogleAnalytics;
