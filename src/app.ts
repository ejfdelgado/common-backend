import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { CustomError } from './errors';
import { HealthSrv } from "./services/health";
import { asyncHandler } from "./tools/General";
import { BucketsSrv } from "./services/bucket";
import { ApiResponse } from './types/types';
import multer from 'multer';
import { HardDriveSrv } from './services/hardDrive';
import { MySQLSrv } from './services/mysql';
import { FirestoreWeb } from './services/firestoreWeb';
import { firebaseAuthMiddleware } from './middleware/firebase-auth.middleware';
import { TemplatesSrv } from './services/templates';
import { RolesAdminSrv } from './services/rolesAdmin';
import { checkRole, isAuthenticated } from './middleware/firebase-role.middleware';
import { ParametersSrv } from './services/parameters';
import { GeminiSrv } from './services/geminiSrv';
import { EmailHandler } from './services/email';
import { SupabaseSrv } from './services/supabase';
import { EmbedSrv } from './services/embeed.service';
import { CalendarService } from './services/calendar.service';

let allowedOrigins = [
    'http://localhost:4200',
    'https://localhost:4200',
];

const upload = multer({ storage: multer.memoryStorage() });

if (process.env.CORS_MAIN_ALLOWED_ORIGIN) {
    allowedOrigins = process.env.CORS_MAIN_ALLOWED_ORIGIN.split(/[;,\s]/).map(e => e.trim()).filter(e => e.length > 0);
}

class App {
    public app: Application;
    public port: number;

    constructor(port: number) {
        this.app = express();
        this.port = port;

        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddlewares(): void {
        this.app.use(cors({
            methods: ["GET", "POST", "DELETE", "PUT"],
            origin: (origin, callback) => {
                // allow requests with no origin (like mobile apps or curl)
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
        }));
        //
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use(firebaseAuthMiddleware);

        // Logging middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    private initializeRoutes(): void {
        // Health check endpoint
        this.app.get('/public/health', HealthSrv.health);
        this.app.post('/public/echo', HealthSrv.echo);
        this.app.get('/check_user', HealthSrv.checkUser);

        this.app.post('/bucket/file', upload.single('file'), asyncHandler(BucketsSrv.saveFile));
        this.app.get('/bucket/file', asyncHandler(BucketsSrv.readFile));
        this.app.delete('/bucket/file', asyncHandler(BucketsSrv.deleteFile));
        this.app.get('/public/bucket/file', asyncHandler(BucketsSrv.readFile));

        this.app.post('/harddrive/file', upload.single('file'), asyncHandler(HardDriveSrv.saveFile));
        this.app.get('/harddrive/file', asyncHandler(HardDriveSrv.readFile));
        this.app.delete('/harddrive/file', asyncHandler(HardDriveSrv.deleteFile));
        this.app.get('/public/harddrive/file', asyncHandler(HardDriveSrv.readFile));

        this.app.get('/public/mysql/check', asyncHandler(MySQLSrv.check));

        this.app.post('/public/firestore', asyncHandler(FirestoreWeb.createUpdate));
        this.app.post('/firestore', asyncHandler(FirestoreWeb.createUpdate));
        this.app.delete('/firestore', asyncHandler(FirestoreWeb.delete));

        this.app.get('/social', asyncHandler(TemplatesSrv.socialShare));

        this.app.get('/admin/users', [isAuthenticated(), asyncHandler(RolesAdminSrv.pageUsers)]);
        this.app.get('/admin/user/roles', [checkRole(["superadmin"]), asyncHandler(RolesAdminSrv.listRoles)]);
        this.app.get('/admin/user/myroles', [isAuthenticated(), asyncHandler(RolesAdminSrv.myRoles)]);
        this.app.get('/admin/user/shared_with', [isAuthenticated(), asyncHandler(RolesAdminSrv.getUsersAllowed)]);
        this.app.put('/admin/user/shared_with', [isAuthenticated(), asyncHandler(RolesAdminSrv.writeUsersAllowed)]);
        this.app.post('/admin/user/calendar/allow', [isAuthenticated(), asyncHandler(RolesAdminSrv.calendarConnect)]);
        this.app.get('/admin/user/calendar/allow/callback', [asyncHandler(RolesAdminSrv.calendarConnectCallback)]);


        this.app.put('/admin/user/roles', [checkRole(["superadmin"]), asyncHandler(RolesAdminSrv.addRole)]);
        this.app.put('/admin/user/roles_all', [checkRole(["superadmin"]), asyncHandler(RolesAdminSrv.setRoles)]);
        this.app.delete('/admin/user/roles', [checkRole(["superadmin"]), asyncHandler(RolesAdminSrv.removeRole)]);

        this.app.post('/params/all', [asyncHandler(ParametersSrv.read)]);
        this.app.get('/params/generate', [checkRole(["developer"]), asyncHandler(ParametersSrv.generateKeyPair)]);
        this.app.get('/params/public_key', [asyncHandler(ParametersSrv.getPublicKey)]);

        // This is public, danger!
        this.app.post('/gemini/query', asyncHandler(GeminiSrv.generate));

        this.app.post("/srv/email/send", [checkRole(["developer"]), asyncHandler(EmailHandler.send)]);
        this.app.post("/srv/email/contact_us", [asyncHandler(EmailHandler.contactUs)]);

        this.app.get("/supabase/check1", [asyncHandler(SupabaseSrv.check1)]);

        this.app.post("/supabase/page", [checkRole(["alterego_editor", "alterego_viewer"]), asyncHandler(SupabaseSrv.pageEmbeed)]);
        this.app.post("/supabase/crud", [checkRole(["alterego_editor"]), asyncHandler(SupabaseSrv.crudEmbeed)]);
        this.app.post("/supabase/search", [checkRole(["alterego_editor", "alterego_viewer"]), asyncHandler(SupabaseSrv.searchEmbeed)]);

        this.app.post("/articles/page", [checkRole(["alterego_editor", "alterego_viewer"]), asyncHandler(SupabaseSrv.pageArticle)]);
        this.app.post("/articles/crud", [checkRole(["alterego_editor"]), asyncHandler(SupabaseSrv.crudArticle)]);
        this.app.post("/articles/search", [checkRole(["alterego_editor", "alterego_viewer"]), asyncHandler(SupabaseSrv.searchArticle)]);

        this.app.get("/embed/use", [checkRole(["developer"]), asyncHandler(EmbedSrv.use)]);

        this.app.post("/calendar/search", [isAuthenticated(), asyncHandler(CalendarService.search)]);


        this.app.use('*', (req: Request, res: Response) => {
            const response: ApiResponse = {
                success: false,
                message: 'Route not found',
                timestamp: new Date()
            };
            res.status(404).json(response);
        });
    }

    private initializeErrorHandling(): void {
        // Error handling middleware
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error('Some error:', err);

            const response: ApiResponse = {
                success: false,
                message: err.message,
                timestamp: new Date()
            };

            if (err instanceof CustomError) {
                res.status((err as CustomError).httpCode).json(response);
            } else {
                res.status(500).json(response);
            }
        });
    }

    public listen(): void {
        this.app.listen(this.port, () => {
            console.log(`Server is running on port ${this.port}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check: http://localhost:${this.port}/public/health`);
        });
    }
}

export default App;