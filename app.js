/**
 * UnSent - Personal Writing Archive
 * Card-based with Modal Overlay
 * Pure vanilla JavaScript - no dependencies
 */

class UnSent {
    constructor() {
        this.allEntries = [];
        this.filteredEntries = [];
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.readingMode = false;
        this.draftMode = false;
        this.leftUnsentMode = false;
        this.readingModePreference = localStorage.getItem('unsent-reading-mode') === 'true';
        this.drafts = JSON.parse(localStorage.getItem('unsent-drafts')) || [];
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.render();
            this.loadDrafts();
        } catch (error) {
            console.error('Failed to initialize UnSent:', error);
            this.showError('Failed to load archive. Please refresh the page.');
        }
    }

    /**
     * Load data from JSON files
     */
    async loadData() {
        try {
            const [proseResponse, poemResponse] = await Promise.all([
                fetch('data/prose.json'),
                fetch('data/poems.json')
            ]);

            if (!proseResponse.ok || !poemResponse.ok) {
                throw new Error('Failed to load data files');
            }

            const proseData = await proseResponse.json();
            const poemData = await poemResponse.json();

            // Add category to each entry
            this.allEntries = [
                ...proseData.map(entry => ({ ...entry, category: 'prose' })),
                ...poemData.map(entry => ({ ...entry, category: 'poem' }))
            ];

            // Sort by pinned, featured, then by date
            this.allEntries.sort((a, b) => {
                if (a.pinned !== b.pinned) return b.pinned - a.pinned;
                if (a.featured !== b.featured) return b.featured - a.featured;
                return new Date(b.date) - new Date(a.date);
            });

            this.filteredEntries = [...this.allEntries];
        } catch (error) {
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Category buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCategoryChange(e));
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Modal controls
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });
        document.getElementById('modalCloseBtn').addEventListener('click', () => this.closeModal());

        // Header buttons
        document.getElementById('readingModeBtn').addEventListener('click', () => this.toggleReadingMode());
        document.getElementById('draftModeBtn').addEventListener('click', () => this.toggleDraftMode());
        document.getElementById('leftUnsentBtn').addEventListener('click', () => this.toggleLeftUnsent());

        // Draft mode controls
        document.getElementById('saveDraftBtn').addEventListener('click', () => this.saveDraft());
        document.getElementById('clearDraftBtn').addEventListener('click', () => this.clearDraftInput());
        document.getElementById('exitDraftBtn').addEventListener('click', () => this.toggleDraftMode());
        document.getElementById('exitLeftUnsentBtn').addEventListener('click', () => this.toggleLeftUnsent());

        // Keyboard shortcut to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    /**
     * Handle category change
     */
    handleCategoryChange(e) {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        
        e.target.classList.add('active');
        e.target.setAttribute('aria-pressed', 'true');
        
        this.currentCategory = e.target.dataset.category;
        this.applyFilters();
    }

    /**
     * Handle search
     */
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    /**
     * Apply filters
     */
    applyFilters() {
        this.filteredEntries = this.allEntries.filter(entry => {
            // Category filter
            if (this.currentCategory !== 'all' && entry.category !== this.currentCategory) {
                return false;
            }

            // Search filter
            if (this.searchQuery) {
                const matchesTitle = entry.title.toLowerCase().includes(this.searchQuery);
                const matchesExcerpt = entry.excerpt.toLowerCase().includes(this.searchQuery);
                const matchesTags = entry.tags.some(tag => tag.toLowerCase().includes(this.searchQuery));
                
                if (!matchesTitle && !matchesExcerpt && !matchesTags) {
                    return false;
                }
            }

            return true;
        });

        this.render();
    }

    /**
     * Render entries as cards
     */
    render() {
        const container = document.getElementById('entriesContainer');
        
        // Clear existing content
        container.innerHTML = '';
        
        // Render each entry as a card
        container.innerHTML = this.filteredEntries.map(entry => {
            const statusIndicators = this.getStatusIndicators(entry);
            const categoryClass = entry.category === 'poem' ? 'poem' : 'prose';
            const unsentClass = entry.unsent ? 'unsent' : '';
            return `
                <div class="entry-item ${categoryClass} ${unsentClass}" data-entry-id="${entry.id}">
                    <div class="entry-header">
                        <div class="entry-title-group">
                            <h3 class="entry-title">${this.escapeHtml(entry.title)}</h3>
                        </div>
                        <div class="entry-status-indicators">
                            ${statusIndicators}
                        </div>
                    </div>
                    
                    <div class="entry-meta">
                        <span class="entry-date">${this.formatDate(entry.date)}</span>
                        <span class="entry-category">${entry.category}</span>
                    </div>
                    
                    <p class="entry-excerpt">${this.escapeHtml(entry.excerpt)}</p>
                </div>
            `;
        }).join('');

        // Add click listeners to cards
        container.querySelectorAll('.entry-item').forEach(card => {
            card.addEventListener('click', () => {
                const entryId = card.dataset.entryId;
                const entry = this.allEntries.find(e => e.id === entryId);
                this.openModal(entry);
            });
        });
    }

    /**
     * Get status indicators (pinned, featured, unsent)
     */
    getStatusIndicators(entry) {
        let html = '';
        
        if (entry.pinned) {
            html += '<span class="status-badge pinned" title="Pinned">📌</span>';
        }
        
        if (entry.featured) {
            html += '<span class="status-badge featured" title="Featured">⭐</span>';
        }
        
        if (entry.unsent) {
            html += '<span class="status-badge unsent" title="Unsent"><span class="unsent-dot"></span></span>';
        }
        
        return html;
    }

    /**
     * Open modal with entry details
     */
    openModal(entry) {
        const modal = document.getElementById('modalOverlay');
        const modalBody = document.getElementById('modalBody');
        
        const statusIndicators = this.getStatusIndicators(entry);
        const tagsHtml = entry.tags && entry.tags.length > 0 
            ? `
                <div class="modal-entry-tags">
                    <span class="modal-tags-title">Tags</span>
                    <div class="modal-tags-list">
                        ${entry.tags.map(tag => `<span class="modal-tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
            ` 
            : '';
        
        const categoryClass = entry.category === 'poem' ? 'poem' : 'prose';
        const contentHtml = this.escapeHtml(entry.excerpt)
            .split('\n\n')
            .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
            .join('');
        
        modalBody.innerHTML = `
            <div class="modal-entry ${categoryClass}">
                <h2 class="modal-entry-title">${this.escapeHtml(entry.title)}</h2>
                
                <div class="modal-entry-meta">
                    <span class="modal-entry-date">${this.formatDate(entry.date)}</span>
                    <span class="modal-entry-category">${entry.category}</span>
                    <div class="modal-entry-status">
                        ${statusIndicators}
                    </div>
                </div>
                
                <div class="modal-entry-content">
                    ${contentHtml}
                </div>
                
                ${tagsHtml}
            </div>
        `;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('modalOverlay');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Toggle reading mode
     */
    toggleReadingMode() {
        this.readingMode = !this.readingMode;
        const btn = document.getElementById('readingModeBtn');
        
        if (this.readingMode) {
            btn.classList.add('active');
            document.body.classList.add('reading-mode');
            localStorage.setItem('unsent-reading-mode', 'true');
        } else {
            btn.classList.remove('active');
            document.body.classList.remove('reading-mode');
            localStorage.setItem('unsent-reading-mode', 'false');
        }
    }

    /**
     * Toggle draft mode
     */
    toggleDraftMode() {
        this.draftMode = !this.draftMode;
        const draftContainer = document.getElementById('draftModeContainer');
        const mainContent = document.getElementById('mainContent');
        const headerUI = document.getElementById('headerUI');
        const navUI = document.getElementById('navUI');
        const footerUI = document.getElementById('footerUI');
        
        if (this.draftMode) {
            mainContent.style.display = 'none';
            headerUI.style.display = 'none';
            navUI.style.display = 'none';
            footerUI.style.display = 'none';
            draftContainer.style.display = 'block';
            document.getElementById('draftModeBtn').classList.add('active');
            document.getElementById('draftText').focus();
        } else {
            mainContent.style.display = 'block';
            headerUI.style.display = 'block';
            navUI.style.display = 'block';
            footerUI.style.display = 'block';
            draftContainer.style.display = 'none';
            document.getElementById('draftModeBtn').classList.remove('active');
        }
    }

    /**
     * Toggle left unsent page
     */
    toggleLeftUnsent() {
        this.leftUnsentMode = !this.leftUnsentMode;
        const leftUnsentContainer = document.getElementById('leftUnsentContainer');
        const mainContent = document.getElementById('mainContent');
        const headerUI = document.getElementById('headerUI');
        const navUI = document.getElementById('navUI');
        const footerUI = document.getElementById('footerUI');
        
        if (this.leftUnsentMode) {
            mainContent.style.display = 'none';
            headerUI.style.display = 'none';
            navUI.style.display = 'none';
            footerUI.style.display = 'none';
            leftUnsentContainer.style.display = 'block';
            this.renderLeftUnsent();
            document.getElementById('leftUnsentBtn').classList.add('active');
        } else {
            mainContent.style.display = 'block';
            headerUI.style.display = 'block';
            navUI.style.display = 'block';
            footerUI.style.display = 'block';
            leftUnsentContainer.style.display = 'none';
            document.getElementById('leftUnsentBtn').classList.remove('active');
        }
    }

    /**
     * Render Left Unsent page (titles only)
     */
    renderLeftUnsent() {
        const leftUnsentContent = document.getElementById('leftUnsentContent');
        const unsentEntries = this.allEntries.filter(entry => entry.unsent);
        
        if (unsentEntries.length === 0) {
            leftUnsentContent.innerHTML = '<div class="empty-state">No unsent entries.</div>';
            return;
        }
        
        leftUnsentContent.innerHTML = unsentEntries.map(entry => `
            <div class="left-unsent-item" data-entry-id="${entry.id}">
                <h3 class="left-unsent-title">${this.escapeHtml(entry.title)}</h3>
            </div>
        `).join('');

        // Add click listeners
        leftUnsentContent.querySelectorAll('.left-unsent-item').forEach(item => {
            item.addEventListener('click', () => {
                const entryId = item.dataset.entryId;
                const entry = this.allEntries.find(e => e.id === entryId);
                this.openModal(entry);
            });
        });
    }

    /**
     * Save draft
     */
    saveDraft() {
        const text = document.getElementById('draftText').value.trim();
        
        if (!text) {
            alert('Please write something before saving.');
            return;
        }
        
        const draft = {
            id: Date.now().toString(),
            content: text,
            date: new Date().toISOString()
        };
        
        this.drafts.push(draft);
        localStorage.setItem('unsent-drafts', JSON.stringify(this.drafts));
        
        document.getElementById('draftText').value = '';
        this.loadDrafts();
    }

    /**
     * Load and display drafts
     */
    loadDrafts() {
        const savedDrafts = document.getElementById('savedDrafts');
        
        if (this.drafts.length === 0) {
            savedDrafts.innerHTML = '<div class="empty-state">No saved drafts yet.</div>';
            return;
        }
        
        savedDrafts.innerHTML = this.drafts.map(draft => {
            const preview = draft.content.substring(0, 50) + (draft.content.length > 50 ? '...' : '');
            const date = new Date(draft.date).toLocaleDateString();
            
            return `
                <div class="saved-draft-item">
                    <div class="draft-item-info">
                        <div class="draft-item-title">${this.escapeHtml(preview)}</div>
                        <div class="draft-item-date">${date}</div>
                    </div>
                    <div class="draft-item-actions">
                        <button class="draft-item-btn" data-draft-id="${draft.id}" data-action="restore">Restore</button>
                        <button class="draft-item-btn" data-draft-id="${draft.id}" data-action="delete">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to draft buttons
        savedDrafts.querySelectorAll('.draft-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const draftId = btn.dataset.draftId;
                const action = btn.dataset.action;
                
                if (action === 'restore') {
                    const draft = this.drafts.find(d => d.id === draftId);
                    if (draft) document.getElementById('draftText').value = draft.content;
                } else if (action === 'delete') {
                    this.drafts = this.drafts.filter(d => d.id !== draftId);
                    localStorage.setItem('unsent-drafts', JSON.stringify(this.drafts));
                    this.loadDrafts();
                }
            });
        });
    }

    /**
     * Clear draft input
     */
    clearDraftInput() {
        if (confirm('Clear the current draft?')) {
            document.getElementById('draftText').value = '';
        }
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('entriesContainer');
        container.innerHTML = `<div class="empty-state">${message}</div>`;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new UnSent();
});
