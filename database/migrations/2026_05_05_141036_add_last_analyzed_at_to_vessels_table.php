<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('vessels', 'last_analyzed_at')) {
            Schema::table('vessels', function (Blueprint $table) {
                $table->timestamp('last_analyzed_at')->nullable()->after('last_seen_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('vessels', 'last_analyzed_at')) {
            Schema::table('vessels', function (Blueprint $table) {
                $table->dropColumn('last_analyzed_at');
            });
        }
    }
};
