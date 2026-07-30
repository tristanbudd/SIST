<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/* Main application route */
Route::get('/', function () {
    return Inertia::render('Index');
});

/* Redirects */
Route::redirect('/documentation', '/docs');
