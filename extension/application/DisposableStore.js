export class DisposableStore {

    constructor() {
        this.resources = [];
        this.disposed = false;
    }

    add(...resources) {
        for (const resource of resources) {
            if (
                !resource ||
                typeof resource.dispose !==
                    "function"
            ) {
                continue;
            }

            if (this.disposed) {
                resource.dispose();
                continue;
            }

            this.resources.push(resource);
        }

        return resources.at(-1) ?? null;
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (
            const resource
            of this.resources.reverse()
        ) {
            resource.dispose();
        }

        this.resources = [];
    }
}
