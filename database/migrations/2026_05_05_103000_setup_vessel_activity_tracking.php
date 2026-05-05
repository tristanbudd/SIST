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
        Schema::create('vessel_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('mmsi');
            $table->string('type');
            $table->enum('severity', ['low', 'medium', 'high'])->default('low');
            $table->text('description')->nullable();
            $table->json('details')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('mmsi')->references('mmsi')->on('vessels')->onDelete('cascade');
            $table->index(['mmsi', 'is_active']);
            $table->index('type');
            $table->index('started_at');
        });

        Schema::table('vessels', function (Blueprint $table) {
            $table->timestamp('last_analyzed_at')->nullable()->after('last_seen_at');
            $table->index('last_analyzed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vessels', function (Blueprint $table) {
            $table->dropIndex(['last_analyzed_at']);
            $table->dropColumn('last_analyzed_at');
        });

        Schema::dropIfExists('vessel_activities');
    }
};
