import { Firestore } from '@google-cloud/firestore'
import { FirestoreOrderType, FirestoreWhereType } from 'ejfdelgado-common-ts';

const firestore = new Firestore();
firestore.settings({
    ignoreUndefinedProperties: true
});

export class MyStore {
    // https://www.npmjs.com/package/@google-cloud/firestore
    static async runTransaction(theFunction: any) {
        /**
         * Con las bibliotecas cliente de Cloud Firestore, puede agrupar 
         * varias operaciones en una sola transacción. Las transacciones 
         * son útiles cuando desea actualizar el valor de un campo según 
         * su valor actual o el valor de algún otro campo. Una transacción 
         * consta de cualquier cantidad de operaciones get() seguidas de 
         * cualquier cantidad de operaciones de escritura, como set() , 
         * update() o delete() . En el caso de una edición simultánea, 
         * Cloud Firestore vuelve a ejecutar toda la transacción. 
         * Por ejemplo, si una transacción lee documentos y otro cliente 
         * modifica cualquiera de esos documentos, Cloud Firestore vuelve 
         * a intentar la transacción. Esta función garantiza que la 
         * transacción se ejecute con datos actualizados y coherentes.
         */
        return await firestore.runTransaction(theFunction);
    }

    static getBatch() {
        /**
         * Si no necesita leer ningún documento en su conjunto de operaciones, 
         * puede ejecutar varias operaciones de escritura como un solo lote que 
         * contiene cualquier combinación de operaciones set() , update() o delete() . 
         * Un lote de escrituras se completa de forma atómica y puede escribir en 
         * varios documentos.
         */
        return firestore.batch();
    }

    // MyStore.expandCollection(collection)
    static expandCollection(collection: string) {
        const prefix = process.env.ENV ? process.env.ENV : "pro";
        return collection.split("/").map((el, index) => {
            if (index % 2 == 0) {
                //collection name
                return prefix + "-" + el
            } else {
                //id
                return el;
            }
        }).join("/");
    }

    static async readByIds(collection: string, ids: string[], firestoreInstance: any = null) {
        const lista = [];
        const theJson: any = {};
        if (ids.length == 0) {
            return theJson;
        }
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            lista.push(firestore.doc(`${MyStore.expandCollection(collection)}/${id}`));
        }
        let response;
        if (firestoreInstance == null) {
            response = await firestore.getAll(...lista);
        } else {
            response = await firestoreInstance.getAll(...lista);
        }
        for (let j = 0; j < response.length; j++) {
            const doc = response[j];
            const data = doc.data();
            if (data) {
                data.id = doc.id;
                theJson[data.id] = data;
            }
        }
        return theJson;
    }

    // Si no encuentra retorna undefined
    static async readById(collection: string, id: string, firestoreInstance: any = null) {
        const document = firestore.doc(`${MyStore.expandCollection(collection)}/${id}`);
        let doc;
        if (firestoreInstance == null) {
            doc = await document.get();
        } else {
            doc = await firestoreInstance.get(document);
        }
        const theJson = doc.data();
        if (theJson) {
            theJson.id = id;
        }
        return theJson;
    }

    static async create(collection: string, payload: any, firestoreInstance: any = null) {
        const elDoc = await firestore.collection(`${MyStore.expandCollection(collection)}`).add(payload);
        if (firestoreInstance == null) {
            payload.id = elDoc.id;
            return payload;
        } else {
            // Please check it later, could not work
            firestoreInstance.add(elDoc, payload);
        }
    }

    static async createById(collection: string, id: string, payload: any, firestoreInstance: any = null) {
        const document = firestore.doc(`${MyStore.expandCollection(collection)}/${id}`);
        if (firestoreInstance == null) {
            await document.set(payload);
        } else {
            firestoreInstance.set(document, payload);// no retorna promesa, sino la misma instancia
        }
        return document;
    }

    static async updateOrCreateById(collection: string, id: string, payload: any, firestoreInstance: any = null) {
        const localKey = `${MyStore.expandCollection(collection)}/${id}`;
        const document = firestore.doc(localKey);
        if (firestoreInstance == null) {
            await document.set(payload, { merge: true });
        } else {
            firestoreInstance.set(document, payload, { merge: true });// no retorna promesa, sino la misma instancia
        }
    }

    static async updateById(collection: string, id: string, payload: any, firestoreInstance: any = null) {
        const document = firestore.doc(`${MyStore.expandCollection(collection)}/${id}`);
        if (firestoreInstance == null) {
            await document.update(payload);
        } else {
            firestoreInstance.update(document, payload);// no retorna promesa, sino la misma instancia
        }
    }

    static async deleteById(collection: string, id: string, firestoreInstance: any = null) {
        const document = firestore.doc(`${MyStore.expandCollection(collection)}/${id}`);
        if (firestoreInstance == null) {
            await document.delete();
        } else {
            firestoreInstance.delete(document);// no retorna promesa, sino la misma instancia
        }
    }

    static async paginate(
        collection: string,
        orderColumns: FirestoreOrderType[],
        offset = 0,
        pageSize = 20,
        where: FirestoreWhereType[] = [],
        firestoreInstance: any = null,
        select: string[] = [],
    ) {
        const collectionReference = firestore.collection(`${MyStore.expandCollection(collection)}`);
        let theQuery: any = collectionReference;
        for (let i = 0; i < orderColumns.length; i++) {
            const orderColumn = orderColumns[i];
            theQuery = theQuery.orderBy(orderColumn.name, orderColumn.dir);
        }

        for (let i = 0; i < where.length; i++) {
            const aWhere = where[i];
            theQuery = theQuery.where(aWhere.key, aWhere.oper, aWhere.value)
        }
        let documents;

        theQuery = theQuery
            .offset(offset)
            .limit(pageSize);

        if (select.length > 0) {
            theQuery = theQuery.select(...select);
        }

        if (firestoreInstance == null) {
            documents = await theQuery.get();
        } else {
            documents = await firestoreInstance.get(theQuery);
        }

        const data = documents.docs.map((d: any) => {
            const temp = d.data();
            temp.id = d.id;
            return temp;
        });
        return data;
    }

    static async exist(collection: string, id: string) {
        const collectionReference = firestore.collection(`${MyStore.expandCollection(collection)}`);
        const snap = await collectionReference
            .doc(id)
            .get();
        if (!snap.exists) {
            return false;
        } else {
            return true;
        }
    }
}


