
// ========================================
// COMMUNITY BOARD
// データ保存・管理
// ========================================

const Works = {

    THREAD_KEY: "community_threads",
    REPORT_KEY: "community_reports",

    // ====================================
    // スレッド取得
    // ====================================

    getThreads() {
        try {
            const data = localStorage.getItem(this.THREAD_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error("スレッド読み込みエラー", error);
            return [];
        }
    },

    // ====================================
    // スレッド保存
    // ====================================

    saveThreads(threads) {
        try {
            localStorage.setItem(
                this.THREAD_KEY,
                JSON.stringify(threads)
            );

            return true;

        } catch (error) {
            console.error("スレッド保存エラー", error);
            return false;
        }
    },

    // ====================================
    // スレッド作成
    // ====================================

    createThread(data) {

        const threads = this.getThreads();

        const newThread = {
            id: crypto.randomUUID(),
            title: data.title,
            category: data.category,
            content: data.content,
            image: data.image || null,
            author: "匿名ユーザー",
            createdAt: new Date().toISOString(),
            comments: []
        };

        threads.unshift(newThread);

        const saved = this.saveThreads(threads);

        return saved ? newThread : null;
    },

    // ====================================
    // コメント・返信追加
    // ====================================

    addComment(threadId, content, parentId = null, image = null) {

        const threads = this.getThreads();

        const thread = threads.find(
            item => item.id === threadId
        );

        if (!thread) {
            return false;
        }

        // コメント配列がない場合の対策
        if (!Array.isArray(thread.comments)) {
            thread.comments = [];
        }

        // 返信先が存在するか確認
        if (parentId) {
            const parentExists = thread.comments.some(
                comment => comment.id === parentId
            );

            if (!parentExists) {
                return false;
            }
        }

        const newComment = {
            id: crypto.randomUUID(),
            parentId: parentId,
            content: content,
            image: image || null,
            author: "匿名ユーザー",
            createdAt: new Date().toISOString()
        };

        thread.comments.push(newComment);

        return this.saveThreads(threads);
    },

    // ====================================
    // 通報一覧取得
    // ====================================

    getReports() {

        try {
            return JSON.parse(
                localStorage.getItem(this.REPORT_KEY) || "[]"
            );

        } catch (error) {
            console.error("通報データ読み込みエラー", error);
            return [];
        }
    },

    // ====================================
    // スレッド通報
    // ====================================

    reportThread(threadId, reason) {

        try {
            const reports = this.getReports();

            const newReport = {
                id: crypto.randomUUID(),
                threadId: threadId,
                reason: reason,
                createdAt: new Date().toISOString(),
                status: "未確認"
            };

            reports.push(newReport);

            localStorage.setItem(
                this.REPORT_KEY,
                JSON.stringify(reports)
            );

            return true;

        } catch (error) {
            console.error("通報保存エラー", error);
            return false;
        }
    },

    // ====================================
    // スレッド削除
    // ====================================

    deleteThread(threadId) {

        const threads = this.getThreads();

        const filtered = threads.filter(
            thread => thread.id !== threadId
        );

        return this.saveThreads(filtered);
    },

    // ====================================
    // コメント削除
    // ====================================

    deleteComment(threadId, commentId) {

        const threads = this.getThreads();

        const thread = threads.find(
            item => item.id === threadId
        );

        if (!thread) {
            return false;
        }

        // 指定コメントと、その返信も削除
        const deleteIds = new Set([commentId]);

        let changed = true;

        while (changed) {
            changed = false;

            thread.comments.forEach(comment => {
                if (
                    comment.parentId &&
                    deleteIds.has(comment.parentId) &&
                    !deleteIds.has(comment.id)
                ) {
                    deleteIds.add(comment.id);
                    changed = true;
                }
            });
        }

        thread.comments = thread.comments.filter(
            comment => !deleteIds.has(comment.id)
        );

        return this.saveThreads(threads);
    },

    // ====================================
    // 全データ削除
    // ====================================

    clearAll() {

        localStorage.removeItem(this.THREAD_KEY);
        localStorage.removeItem(this.REPORT_KEY);

    }

};
