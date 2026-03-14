// ================================================================
// 📅 ECONOMIC CALENDAR MODULE - Mock
// ================================================================

interface CalendarEvent {
    id:       string;
    time:     string;  // HH:MM
    country:  string;  // flag code e.g. 'us', 'gb'
    currency: string;  // e.g. 'USD', 'EUR'
    impact:   'low' | 'medium' | 'high';
    name:     string;
    actual:   string | null;
    forecast: string | null;
    previous: string | null;
    history:  { date: string; actual: string; forecast: string; prev: string }[];
    description: string;
}

type DayTab = 'yesterday' | 'today' | 'tomorrow';
type ImpactFilter = 'all' | 'high' | 'high-medium';

export class EconomicCalendarModule {

    private container:     HTMLElement | null = null;
    private eventList:     HTMLElement | null = null;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private currentDay:    DayTab = 'today';
    private impactFilter:  ImpactFilter = 'high';
    private expandedId:    string | null = null;

    // ── Mock data ──
    private readonly MOCK_DATA: Record<DayTab, CalendarEvent[]> = {
        yesterday: [
            {
                id: 'rba-minutes',
                time: '02:30', country: 'au', currency: 'AUD', impact: 'medium',
                name: 'RBA Meeting Minutes',
                actual: '4.35%', forecast: '4.10%', previous: '4.10%',
                description: 'Minutes of the RBA monetary policy meeting. Provides insight into economic conditions that influenced their rate decision.',
                history: [
                    { date: 'Feb', actual: '4.35%', forecast: '4.10%', prev: '4.10%' },
                    { date: 'Jan', actual: '4.10%', forecast: '3.85%', prev: '3.85%' },
                    { date: 'Dec', actual: '3.85%', forecast: '3.85%', prev: '3.85%' },
                    { date: 'Nov', actual: '3.60%', forecast: '3.85%', prev: '3.85%' },
                ]
            },
            {
                id: 'german-cpi-yest',
                time: '07:00', country: 'de', currency: 'EUR', impact: 'high',
                name: 'German CPI m/m',
                actual: '0.4%', forecast: '0.3%', previous: '0.2%',
                description: 'Change in the price of goods and services in Germany. Leading indicator for Eurozone inflation.',
                history: [
                    { date: 'Mar', actual: '0.4%', forecast: '0.3%', prev: '0.2%' },
                    { date: 'Feb', actual: '0.2%', forecast: '0.2%', prev: '0.1%' },
                    { date: 'Jan', actual: '0.1%', forecast: '0.2%', prev: '0.2%' },
                    { date: 'Dec', actual: '0.3%', forecast: '0.2%', prev: '0.2%' },
                ]
            },
            {
                id: 'us-jobless',
                time: '13:30', country: 'us', currency: 'USD', impact: 'high',
                name: 'Unemployment Claims',
                actual: '218K', forecast: '225K', previous: '227K',
                description: 'Number of individuals who filed for unemployment insurance for the first time. Lower than expected is bullish USD.',
                history: [
                    { date: 'W4', actual: '218K', forecast: '225K', prev: '227K' },
                    { date: 'W3', actual: '227K', forecast: '220K', prev: '215K' },
                    { date: 'W2', actual: '215K', forecast: '218K', prev: '220K' },
                    { date: 'W1', actual: '220K', forecast: '222K', prev: '225K' },
                ]
            },
            {
                id: 'boe-yest',
                time: '12:00', country: 'gb', currency: 'GBP', impact: 'low',
                name: 'BOE Credit Conditions',
                actual: '12.4', forecast: '11.0', previous: '10.8',
                description: 'Bank of England quarterly survey of credit conditions in the UK economy.',
                history: [
                    { date: 'Q4', actual: '12.4', forecast: '11.0', prev: '10.8' },
                    { date: 'Q3', actual: '10.8', forecast: '10.5', prev: '10.2' },
                    { date: 'Q2', actual: '10.2', forecast: '10.0', prev: '9.8'  },
                    { date: 'Q1', actual: '9.8',  forecast: '9.5',  prev: '9.2'  },
                ]
            },
        ],
        today: [
            {
                id: 'german-cpi',
                time: '07:00', country: 'de', currency: 'EUR', impact: 'high',
                name: 'German CPI m/m',
                actual: '0.1%', forecast: '0.3%', previous: '0.2%',
                description: 'Change in price of goods and services in Germany. Leading indicator for Eurozone inflation. Higher than expected = bullish EUR.',
                history: [
                    { date: 'Mar', actual: '0.1%', forecast: '0.3%', prev: '0.2%' },
                    { date: 'Feb', actual: '0.4%', forecast: '0.2%', prev: '0.1%' },
                    { date: 'Jan', actual: '0.2%', forecast: '0.2%', prev: '0.2%' },
                    { date: 'Dec', actual: '0.1%', forecast: '0.3%', prev: '0.3%' },
                ]
            },
            {
                id: 'uk-gdp',
                time: '09:30', country: 'gb', currency: 'GBP', impact: 'high',
                name: 'UK GDP m/m',
                actual: '0.2%', forecast: '0.1%', previous: '0.0%',
                description: 'Change in the value of all goods and services produced in the UK. Main measure of economic activity.',
                history: [
                    { date: 'Mar', actual: '0.2%', forecast: '0.1%', prev: '0.0%' },
                    { date: 'Feb', actual: '0.0%', forecast: '0.1%', prev: '-0.1%' },
                    { date: 'Jan', actual: '-0.1%',forecast: '0.0%', prev: '0.1%'  },
                    { date: 'Dec', actual: '0.1%', forecast: '0.1%', prev: '0.2%'  },
                ]
            },
            {
                id: 'core-cpi',
                time: '13:30', country: 'us', currency: 'USD', impact: 'high',
                name: 'Core CPI m/m',
                actual: null, forecast: '0.3%', previous: '0.4%',
                description: "Change in price of goods excluding food and energy. The Fed's preferred inflation measure. Higher than expected = bullish USD.",
                history: [
                    { date: 'Feb', actual: '0.2%', forecast: '0.3%', prev: '0.3%' },
                    { date: 'Jan', actual: '0.4%', forecast: '0.3%', prev: '0.2%' },
                    { date: 'Dec', actual: '0.3%', forecast: '0.3%', prev: '0.3%' },
                    { date: 'Nov', actual: '0.3%', forecast: '0.2%', prev: '0.2%' },
                ]
            },
            {
                id: 'fed-speech',
                time: '15:00', country: 'us', currency: 'USD', impact: 'high',
                name: 'Fed Chair Speech',
                actual: null, forecast: null, previous: null,
                description: 'Federal Reserve Chair public address. Watch for hints on future rate decisions and inflation outlook. Can cause significant USD volatility.',
                history: []
            },
            {
                id: 'boe-speech',
                time: '17:30', country: 'gb', currency: 'GBP', impact: 'medium',
                name: 'BOE Gov Bailey Speech',
                actual: null, forecast: null, previous: null,
                description: 'Bank of England Governor speech. Comments on monetary policy and inflation outlook can significantly move GBP pairs.',
                history: []
            },
            {
                id: 'eu-sentiment',
                time: '10:00', country: 'eu', currency: 'EUR', impact: 'low',
                name: 'EU Economic Sentiment',
                actual: '96.3', forecast: '96.0', previous: '95.8',
                description: 'Survey of economic conditions in the Eurozone. Measures business and consumer confidence.',
                history: [
                    { date: 'Mar', actual: '96.3', forecast: '96.0', prev: '95.8' },
                    { date: 'Feb', actual: '95.8', forecast: '95.5', prev: '95.2' },
                    { date: 'Jan', actual: '95.2', forecast: '95.0', prev: '94.8' },
                    { date: 'Dec', actual: '94.8', forecast: '94.5', prev: '94.2' },
                ]
            },
        ],
        tomorrow: [
            {
                id: 'nfp',
                time: '13:30', country: 'us', currency: 'USD', impact: 'high',
                name: 'Non-Farm Payrolls',
                actual: null, forecast: '185K', previous: '199K',
                description: 'Change in number of employed people excluding farming. Most important USD indicator — expect high volatility on release.',
                history: [
                    { date: 'Mar', actual: null,   forecast: '185K', prev: '199K' },
                    { date: 'Feb', actual: '199K', forecast: '180K', prev: '216K' },
                    { date: 'Jan', actual: '216K', forecast: '185K', prev: '223K' },
                    { date: 'Dec', actual: '223K', forecast: '200K', prev: '256K' },
                ]
            },
            {
                id: 'unemployment-rate',
                time: '13:30', country: 'us', currency: 'USD', impact: 'high',
                name: 'Unemployment Rate',
                actual: null, forecast: '3.7%', previous: '3.7%',
                description: 'Percentage of total workforce that is unemployed. Released alongside NFP. Lower than expected = bullish USD.',
                history: [
                    { date: 'Mar', actual: null,   forecast: '3.7%', prev: '3.7%' },
                    { date: 'Feb', actual: '3.7%', forecast: '3.7%', prev: '3.8%' },
                    { date: 'Jan', actual: '3.8%', forecast: '3.7%', prev: '3.7%' },
                    { date: 'Dec', actual: '3.7%', forecast: '3.8%', prev: '3.9%' },
                ]
            },
            {
                id: 'canada-jobs',
                time: '13:30', country: 'ca', currency: 'CAD', impact: 'high',
                name: 'Canada Employment',
                actual: null, forecast: '20.0K', previous: '37.3K',
                description: 'Change in number of employed people in Canada. Released same time as US NFP — can cause volatile CAD pairs.',
                history: [
                    { date: 'Mar', actual: null,    forecast: '20.0K', prev: '37.3K' },
                    { date: 'Feb', actual: '37.3K', forecast: '15.0K', prev: '-0.3K' },
                    { date: 'Jan', actual: '-0.3K', forecast: '15.0K', prev: '25.0K' },
                    { date: 'Dec', actual: '25.0K', forecast: '13.5K', prev: '24.9K' },
                ]
            },
            {
                id: 'ecb-minutes',
                time: '12:30', country: 'eu', currency: 'EUR', impact: 'medium',
                name: 'ECB Meeting Minutes',
                actual: null, forecast: null, previous: null,
                description: 'Detailed minutes of the ECB monetary policy meeting. Provides insight into the reasoning behind rate decisions.',
                history: []
            },
            {
                id: 'jp-cpi',
                time: '23:30', country: 'jp', currency: 'JPY', impact: 'medium',
                name: 'Japan CPI y/y',
                actual: null, forecast: '2.8%', previous: '2.9%',
                description: 'Change in price of goods and services in Japan. BOJ closely monitors this for monetary policy decisions.',
                history: [
                    { date: 'Mar', actual: null,   forecast: '2.8%', prev: '2.9%' },
                    { date: 'Feb', actual: '2.9%', forecast: '2.8%', prev: '3.1%' },
                    { date: 'Jan', actual: '3.1%', forecast: '3.0%', prev: '3.3%' },
                    { date: 'Dec', actual: '3.3%', forecast: '3.2%', prev: '3.5%' },
                ]
            },
        ]
    };

    // ================================================================
    // INITIALIZE
    // ================================================================

    public initialize(): void {
        this.container = document.querySelector('.calendar-panel');
        this.eventList = document.getElementById('calendarEventList');

        if (!this.container || !this.eventList) {
            console.warn('⚠️ Calendar: container not found');
            return;
        }

        this.bindEvents();
        this.render();

        console.log('✅ Economic Calendar Module initialized (mock)');
    }

    // ================================================================
    // DESTROY
    // ================================================================

    public destroy(): void {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        console.log('🗑️ Economic Calendar Module destroyed');
    }

    // ================================================================
    // BIND EVENTS
    // ================================================================

    private bindEvents(): void {
        // Day tabs
        document.querySelectorAll('.cal-day-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const day = tab.getAttribute('data-day') as DayTab;
                if (!day) return;
                this.currentDay = day;
                this.expandedId = null;
                document.querySelectorAll('.cal-day-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.render();
            });
        });

        // Settings dropdown
        const settingsBtn = document.getElementById('calendarSettingsBtn');
        const settingsDrop = document.getElementById('calendarSettingsDrop');

        settingsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDrop?.classList.toggle('show');
        });

        document.addEventListener('click', () => settingsDrop?.classList.remove('show'));

        document.querySelectorAll('.cal-settings-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const filter = opt.getAttribute('data-filter') as ImpactFilter;
                if (!filter) return;
                this.impactFilter = filter;
                document.querySelectorAll('.cal-settings-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                settingsDrop?.classList.remove('show');
                this.render();
            });
        });
    }

    // ================================================================
    // RENDER
    // ================================================================

    private render(): void {
        if (!this.eventList) return;

        // Stop existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        const events = this.getFilteredEvents();
        this.eventList.innerHTML = '';

        if (!events.length) {
            this.eventList.innerHTML = `
                <div class="cal-empty">
                    <i class="fas fa-calendar-xmark"></i>
                    <p>No events match your filter.</p>
                </div>`;
            return;
        }

        if (this.currentDay === 'today') {
            const past     = events.filter(e => this.isPast(e.time));
            const upcoming = events.filter(e => !this.isPast(e.time));

            if (past.length) {
                this.eventList.appendChild(this.buildGroupHeader('Earlier today', past.length));
                past.forEach(e => this.eventList!.appendChild(this.buildEventItem(e, 'past')));
            }

            if (upcoming.length) {
                this.eventList.appendChild(this.buildGroupHeader('Upcoming', upcoming.length));
                upcoming.forEach((e, i) => {
                    const type = i === 0 ? 'upcoming' : 'normal';
                    this.eventList!.appendChild(this.buildEventItem(e, type));
                });
            }

            // Start countdown for first upcoming event
            const nextEvent = upcoming[0];
            if (nextEvent) this.startCountdown(nextEvent);

        } else {
            const label = this.currentDay === 'yesterday' ? 'All events' : 'Scheduled';
            this.eventList.appendChild(this.buildGroupHeader(label, events.length));
            events.forEach(e => {
                const type = this.currentDay === 'yesterday' ? 'past' : 'normal';
                this.eventList!.appendChild(this.buildEventItem(e, type));
            });
        }

        // Re-expand previously expanded event
        if (this.expandedId) {
            const detail = document.getElementById(`cal-detail-${this.expandedId}`);
            const item   = this.eventList.querySelector(`[data-event-id="${this.expandedId}"]`);
            if (detail && item) {
                detail.classList.add('show');
                item.classList.add('expanded');
            }
        }
    }

    // ================================================================
    // BUILD GROUP HEADER
    // ================================================================

    private buildGroupHeader(label: string, count: number): HTMLElement {
        const el = document.createElement('div');
        el.className = 'cal-group-header';
        el.innerHTML = `${label} <span>${count} events</span>`;
        return el;
    }

    // ================================================================
    // BUILD EVENT ITEM
    // ================================================================

    private buildEventItem(ev: CalendarEvent, type: 'past' | 'upcoming' | 'normal'): HTMLElement {
        const wrapper = document.createElement('div');

        // ── Item ──
        const item = document.createElement('div');
        item.className = `cal-event-item${type === 'upcoming' ? ' upcoming' : ''}`;
        item.setAttribute('data-event-id', ev.id);

        const timeCls    = type === 'upcoming' ? 'cal-event-time soon' : 'cal-event-time';
        const impactDots = this.buildImpactDots(ev.impact);
        const values     = this.buildValues(ev);

        item.innerHTML = `
            <div class="cal-event-top">
                <span class="${timeCls}">${ev.time}</span>
                <div class="cal-event-flag"
                     style="background-image:url('https://flagcdn.com/w320/${ev.country}.png');"></div>
                ${impactDots}
                <span class="cal-event-name">${ev.name}</span>
                <span class="cal-event-currency">${ev.currency}</span>
                <i class="fas fa-chevron-down cal-event-chevron"></i>
            </div>
            ${values}
        `;

        // ── Detail ──
        const detail = this.buildDetail(ev, type);

        item.addEventListener('click', () => this.toggleExpand(ev.id, item, detail));

        wrapper.appendChild(item);
        wrapper.appendChild(detail);
        return wrapper;
    }

    // ================================================================
    // BUILD IMPACT DOTS
    // ================================================================

    private buildImpactDots(impact: 'low' | 'medium' | 'high'): string {
        const count = impact === 'low' ? 1 : impact === 'medium' ? 2 : 3;
        return `
            <div class="cal-impact-dots">
                ${[1,2,3].map(i => `
                    <span class="cal-impact-dot${i <= count ? ` filled ${impact}` : ''}"></span>
                `).join('')}
            </div>`;
    }

    // ================================================================
    // BUILD VALUES ROW
    // ================================================================

    private buildValues(ev: CalendarEvent): string {
        const actualClass = this.getActualClass(ev);
        const actualText  = ev.actual ?? '—';
        const forecastText = ev.forecast ?? '—';
        const previousText = ev.previous ?? '—';

        return `
            <div class="cal-event-values">
                <div class="cal-event-val">
                    <span class="cal-val-label">Actual</span>
                    <span class="cal-val-num actual ${actualClass}">${actualText}</span>
                </div>
                <div class="cal-event-val">
                    <span class="cal-val-label">Forecast</span>
                    <span class="cal-val-num">${forecastText}</span>
                </div>
                <div class="cal-event-val">
                    <span class="cal-val-label">Previous</span>
                    <span class="cal-val-num">${previousText}</span>
                </div>
            </div>`;
    }

    // ================================================================
    // BUILD DETAIL
    // ================================================================

    private buildDetail(ev: CalendarEvent, type: 'past' | 'upcoming' | 'normal'): HTMLElement {
        const detail = document.createElement('div');
        detail.className = 'cal-event-detail';
        detail.id = `cal-detail-${ev.id}`;

        let html = '';

        // Countdown for upcoming
        if (ev.actual === null && type !== 'past') {
            html += `
                <div class="cal-countdown" id="cal-countdown-${ev.id}">
                    <i class="fas fa-clock"></i> Calculating...
                </div>`;
        }

        // Description
        if (ev.description) {
            html += `<div class="cal-detail-desc">${ev.description}</div>`;
        }

        // History table
        if (ev.history.length) {
            html += `
                <div class="cal-history-label">Past Releases</div>
                <table class="cal-history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Actual</th>
                            <th>Forecast</th>
                            <th>Prev</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ev.history.map(h => {
                            const cls = h.actual && h.forecast
                                ? parseFloat(h.actual) >= parseFloat(h.forecast) ? 'beat' : 'miss'
                                : '';
                            return `
                                <tr>
                                    <td>${h.date}</td>
                                    <td class="${cls}">${h.actual ?? '—'}</td>
                                    <td>${h.forecast}</td>
                                    <td>${h.prev}</td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>`;
        }

        detail.innerHTML = html;
        return detail;
    }

    // ================================================================
    // TOGGLE EXPAND
    // ================================================================

    private toggleExpand(id: string, item: HTMLElement, detail: HTMLElement): void {
        const isOpen = detail.classList.contains('show');

        // Close all
        document.querySelectorAll('.cal-event-detail').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.cal-event-item').forEach(i => i.classList.remove('expanded'));

        if (!isOpen) {
            detail.classList.add('show');
            item.classList.add('expanded');
            this.expandedId = id;
        } else {
            this.expandedId = null;
        }
    }

    // ================================================================
    // COUNTDOWN
    // ================================================================

    private startCountdown(ev: CalendarEvent): void {
        const el = document.getElementById(`cal-countdown-${ev.id}`);
        if (!el) return;

        const update = () => {
            const now    = new Date();
            const [h, m] = ev.time.split(':').map(Number);
            const target = new Date();
            target.setHours(h, m, 0, 0);
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                el.innerHTML = `<i class="fas fa-bolt"></i> Releasing now`;
                if (this.countdownInterval) clearInterval(this.countdownInterval);
                return;
            }

            const hh = String(Math.floor(diff / 3600000)).padStart(2, '0');
            const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
            const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            el.innerHTML = `<i class="fas fa-clock"></i> Releases in ${hh}:${mm}:${ss}`;
        };

        update();
        this.countdownInterval = setInterval(update, 1000);
    }

    // ================================================================
    // HELPERS
    // ================================================================

    private getFilteredEvents(): CalendarEvent[] {
        const events = [...this.MOCK_DATA[this.currentDay]];

        const filtered = events.filter(e => {
            if (this.impactFilter === 'all')          return true;
            if (this.impactFilter === 'high')         return e.impact === 'high';
            if (this.impactFilter === 'high-medium')  return e.impact === 'high' || e.impact === 'medium';
            return true;
        });

        return filtered.sort((a, b) => a.time.localeCompare(b.time));
    }

    private isPast(time: string): boolean {
        const now  = new Date();
        const [h, m] = time.split(':').map(Number);
        const eventTime = new Date();
        eventTime.setHours(h, m, 0, 0);
        return eventTime < now;
    }

    private getActualClass(ev: CalendarEvent): string {
        if (!ev.actual) return 'pending';
        if (!ev.forecast) return '';
        const actual   = parseFloat(ev.actual);
        const forecast = parseFloat(ev.forecast);
        if (actual > forecast)  return 'beat';
        if (actual < forecast)  return 'miss';
        return 'match';
    }
}