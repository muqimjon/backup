using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackupHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrillStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "DrillRows",
                table: "Artifacts",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DrillStatus",
                table: "Artifacts",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DrillTables",
                table: "Artifacts",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DrilledAt",
                table: "Artifacts",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DrillRows",
                table: "Artifacts");

            migrationBuilder.DropColumn(
                name: "DrillStatus",
                table: "Artifacts");

            migrationBuilder.DropColumn(
                name: "DrillTables",
                table: "Artifacts");

            migrationBuilder.DropColumn(
                name: "DrilledAt",
                table: "Artifacts");
        }
    }
}
